import algosdk, { EncodedSignedTransaction, SuggestedParams, Transaction } from "algosdk";

import { AlgoSigner, JsonPayload, WalletTransaction } from "../algo-signer-types";
import { BuilderError, ERRORS } from "../errors/errors";
import {
	ExecParams,
	isSDKTransactionAndSign,
	Sign,
	SignType,
	TransactionAndSign,
	TxParams,
} from "../types";
import { WAIT_ROUNDS } from "./constants";
import { log } from "./logger";
import { mkTransaction } from "./txn";

const CONFIRMED_ROUND = "confirmed-round";
const LAST_ROUND = "last-round";

export class WebMode {
	algoSigner: AlgoSigner;
	chainName: string;

	constructor(algoSigner: AlgoSigner, chainName: string) {
		this.algoSigner = algoSigner;
		this.chainName = chainName;
	}

	/**
	 * wait for confirmation for transaction using transaction id
	 * @param txId Transaction id
	 */
	async waitForConfirmation(
		txId: string,
		waitRounds = WAIT_ROUNDS
	): Promise<algosdk.modelsv2.PendingTransactionResponse> {
		const response = await this.algoSigner.algod({
			ledger: this.chainName,
			path: "/v2/status",
		});
		log(response);
		const startRound = response[LAST_ROUND] as number;
		let currentRound = startRound;
		// eslint-disable-next-line no-constant-condition
		while (currentRound < startRound + waitRounds) {
			const pendingInfo = await this.algoSigner.algod({
				ledger: this.chainName,
				path: `/v2/transactions/pending/${txId}`,
			});
			if (
				pendingInfo[CONFIRMED_ROUND] !== null &&
				(pendingInfo[CONFIRMED_ROUND] as number) > 0
			) {
				return pendingInfo as unknown as algosdk.modelsv2.PendingTransactionResponse;
			}
			// TODO: maybe we should use "sleep" instead of pinging a node again?
			currentRound += 1;
			await this.algoSigner.algod({
				ledger: this.chainName,
				path: `/v2/status/wait-for-block-after/${currentRound}`, // eslint-disable-line @typescript-eslint/restrict-template-expressions
			});
		}
		throw new Error(`Transaction not confirmed after ${waitRounds} rounds`);
	}

	/**
	 * Send signed transaction to network and wait for confirmation
	 * @param signedTxn Signed Transaction blob encoded in base64
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 */
	async sendAndWait(
		signedTxn: string,
		waitRounds = WAIT_ROUNDS
	): Promise<algosdk.modelsv2.PendingTransactionResponse> {
		const txInfo = await this.algoSigner.send({
			ledger: this.chainName,
			tx: signedTxn,
		});
		if (txInfo && typeof txInfo.txId === "string") {
			return await this.waitForConfirmation(txInfo.txId);
		}
		throw new Error("Transaction Error");
	}

	/**
	 * Send group transaction to network
	 * @param signedTxs signed transaction group
	 */
	async sendGroupTransaction(signedTxs: any): Promise<JsonPayload> {
		// The AlgoSigner.signTxn() response would look like '[{ txID, blob }, null]'
		// Convert first transaction to binary from the response
		const signedTxBinary: Uint8Array[] = signedTxs.map(
			(txn: { txID: string; blob: string }) => {
				return this.algoSigner.encoding.base64ToMsgpack(txn.blob);
			}
		);

		// Merge transaction binaries into a single Uint8Array
		const flatNumberArray = signedTxBinary.reduce((acc: number[], curr) => {
			acc.push(...curr);
			return acc;
		}, []);
		const combinedBinaryTxns = new Uint8Array(flatNumberArray);

		// Convert the combined array values back to base64
		const combinedBase64Txns = this.algoSigner.encoding.msgpackToBase64(combinedBinaryTxns);
		return await this.algoSigner.send({
			ledger: this.chainName,
			tx: combinedBase64Txns,
		});
	}

	/**
	 * Sign transaction using algosigner
	 * @param txns Array of transactions in base64
	 */
	async signTransaction(txns: WalletTransaction[]): Promise<JsonPayload> {
		return await this.algoSigner.signTxn(txns);
	}

	/**
	 * Returns suggested transaction parameters using algosigner
	 * @param userParams Transaction parameters
	 */
	async getSuggestedParams(userParams: TxParams): Promise<SuggestedParams> {
		const txParams = await this.algoSigner.algod({
			ledger: this.chainName,
			path: "/v2/transactions/params",
		});
		const s: SuggestedParams = {
			fee: txParams.fee as number,
			genesisHash: txParams["genesis-hash"] as string,
			genesisID: txParams["genesis-id"] as string,
			firstRound: txParams[LAST_ROUND] as number,
			lastRound: Number(txParams[LAST_ROUND]) + 1000,
			flatFee: false,
		};

		s.flatFee = userParams.totalFee !== undefined;
		s.fee = userParams.totalFee || userParams.feePerByte || (txParams["min-fee"] as number); // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
		if (s.flatFee) s.fee = Math.max(Number(s.fee), Number(txParams["min-fee"]));

		s.firstRound = userParams.firstValid || s.firstRound; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
		s.lastRound =
			userParams.firstValid === undefined || userParams.validRounds === undefined // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
				? s.lastRound
				: Number(userParams.firstValid) + Number(userParams.validRounds);

		return s;
	}

	/**
	 * Appends signature to a multisig transaction using algosigner
	 * @param txns array of multisignature transaction with at least one signature
	 * @param signers a subset of addresses to sign the transaction
	 * return an object containing a blob attribute encoded in base64
	 */
	async appendSignMultisigTransaction(txns: WalletTransaction[], signers: string[]): Promise<JsonPayload> {
		const result:JsonPayload = {};
		for (let i = 0; i < txns.length; ++i) {
			const txn = txns[i];
			const partialTxn = algosdk.decodeObj(
				this.algoSigner.encoding.base64ToMsgpack(txn.txn)) as EncodedSignedTransaction; 
			if (partialTxn.txn === undefined || partialTxn.msig === undefined) {
				throw new Error("Input transaction must be multisigature transaction signed with at least 1 signature");
			} 
			const txnToBeSign = algosdk.Transaction.from_obj_for_encoding(partialTxn.txn);
			const txnToBeSign_Uint8Array = algosdk.encodeObj(txnToBeSign.get_obj_for_encoding());
			const txnToBeSign_Base64 = this.algoSigner.encoding.msgpackToBase64(txnToBeSign_Uint8Array);

			const mparams = partialTxn.msig as algosdk.EncodedMultisig;
			const addrs = mparams.subsig.map((signData) => {
				return algosdk.encodeAddress(signData.pk);
			});

			const multisigParams = {
				version: mparams.v,
				threshold: mparams.thr,
				addrs: addrs,
			}

			const signedTxn = await this.signTransaction([
				{
					txn: txnToBeSign_Base64,
					msig: multisigParams,
					signers: signers,
				},
			]);

			const signedTxnJson = signedTxn[0] as JsonPayload;
			const blob = signedTxnJson.blob as string;

			const blob1 = this.algoSigner.encoding.base64ToMsgpack(txn.txn);
			const blob2 = this.algoSigner.encoding.base64ToMsgpack(blob);
			const combineBlob = algosdk.mergeMultisigTransactions([
				blob1,
				blob2,
			]);
			const outputBase64 = this.algoSigner.encoding.msgpackToBase64(combineBlob);
			result[i] = {
				blob: outputBase64
			};
		}
		return result;
	}

	/**
	 * Execute single transaction or group of transactions (atomic transaction)
	 * Check out {@link https://algobuilder.dev/guide/execute-transaction.html#execute-transaction|execute-transaction}
	 * for more info.
	 * @param transactions transaction parameters, atomic transaction parameters
	 * or TransactionAndSign object(SDK transaction object and signer parameters).
	 * When list of ExecParams is used, the function will request wallet to sign transactions.
	 */
	async executeTx(
		transactions: ExecParams[] | TransactionAndSign[]
	): Promise<algosdk.modelsv2.PendingTransactionResponse> {
		let txns: Transaction[] = [];
		if (transactions.length > 16 || transactions.length == 0) {
			throw new BuilderError(ERRORS.GENERAL.TRANSACTION_LENGTH_ERROR, {
				length: transactions.length,
			});
		}

		if (isSDKTransactionAndSign(transactions[0]))
			throw new Error("We don't support this case now");

		const execParams = transactions as ExecParams[];
		for (const [_, txn] of execParams.entries()) {
			txns.push(mkTransaction(txn, await this.getSuggestedParams(txn.payFlags)));
		}

		txns = algosdk.assignGroupID(txns);

		const binaryTxs = txns.map((txn: Transaction) => {
			return txn.toByte();
		});

		const base64Txs = binaryTxs.map((txn: Uint8Array) => {
			return this.algoSigner.encoding.msgpackToBase64(txn);
		});

		// with logic signature we don't need signers.
		const toBeSignedTxns = base64Txs.map((txn: string, txnId: number) => {
			return execParams[txnId].sign === SignType.LogicSignature
				? { txn: txn, signers: [] } // logic signature
				: { txn: txn, authAddr: execParams[txnId].fromAccount?.addr }; // set signer
		});

		const signedTxn = await this.signTransaction(toBeSignedTxns);

		// sign smart signature transaction
		for (const [txnId, txn] of txns.entries()) {
			const singer: Sign = execParams[txnId];
			if (singer.sign === SignType.LogicSignature) {
				singer.lsig.lsig.args = singer.args ? singer.args : [];
				const lsigTxn = algosdk.signLogicSigTransaction(txn, singer.lsig);
				signedTxn[txnId] = {
					blob: this.algoSigner.encoding.msgpackToBase64(lsigTxn.blob),
					txId: lsigTxn.txID,
				};
			}
		}

		const txInfo = await this.sendGroupTransaction(signedTxn);

		if (txInfo && typeof txInfo.txId === "string") {
			return await this.waitForConfirmation(txInfo.txId);
		}
		throw new Error("Transaction Error");
	}
}
