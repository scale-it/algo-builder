import algosdk, {
	EncodedSignedTransaction,
	encodeObj,
	SignedTransaction,
	SuggestedParams,
	Transaction,
} from "algosdk";

import { AlgoSigner, JsonPayload, WalletTransaction } from "../algo-signer-types";
import { BuilderError, ERRORS } from "../errors/errors";
import {
	ExecParams,
	isSDKTransactionAndSign,
	Sign,
	SignType,
	SignWithMultisig,
	TransactionAndSign,
	TxnReceipt,
	TxParams,
} from "../types";
import { WAIT_ROUNDS } from "./constants";
import { error, log } from "./logger";
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
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 * @returns TxnReceipt which includes confirmed txn response along with txID
	 */
	async waitForConfirmation(
		txId: string,
		waitRounds: number = WAIT_ROUNDS
	): Promise<TxnReceipt> {
		try {
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
					const txnReceipt = { txID: txId, ...pendingInfo };
					return txnReceipt as TxnReceipt;
				}
				// TODO: maybe we should use "sleep" instead of pinging a node again?
				currentRound += 1;
				await this.algoSigner.algod({
					ledger: this.chainName,
					path: `/v2/status/wait-for-block-after/${currentRound}`, // eslint-disable-line @typescript-eslint/restrict-template-expressions
				});
			}
			throw new Error(`Transaction not confirmed after ${waitRounds} rounds`);
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Send signed transaction to network and wait for confirmation
	 * @param signedTxn Signed Transaction blob encoded in base64
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 * @returns TxnReceipt which includes confirmed txn response along with txID
	 */
	async sendAndWait(signedTxn: string, waitRounds: number = WAIT_ROUNDS): Promise<TxnReceipt> {
		try {
			const txInfo = await this.algoSigner.send({
				ledger: this.chainName,
				tx: signedTxn,
			});
			if (txInfo && typeof txInfo.txId === "string") {
				return await this.waitForConfirmation(txInfo.txId, waitRounds);
			}
			throw new Error("Transaction Error");
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Send group transaction to network
	 * @param signedTxs signed transaction group
	 */
	async sendGroupTransaction(signedTxs: any): Promise<JsonPayload> {
		try {
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
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Sign transaction using algosigner
	 * @param txns Array of transactions in base64
	 */
	async signTransaction(txns: WalletTransaction[]): Promise<JsonPayload> {
		try {
			return await this.algoSigner.signTxn(txns);
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Returns suggested transaction parameters using algosigner
	 * @param userParams Transaction parameters
	 */
	async getSuggestedParams(userParams: TxParams): Promise<SuggestedParams> {
		try {
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
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Appends signature to a multisig transaction using algosigner
	 * @param txn Multisignature Encoded Transaction  
	 * @param signers a subset of addresses to sign the transaction
	 * return an object containing a blob key encoded in base64
	 */
	async appendSignMultisigTransaction(
		txn: EncodedSignedTransaction,
		signers?: string[]
	): Promise<JsonPayload> {
		try {
			if (!txn.msig) {
				throw new Error("Current transaction is not a Multisig Transaction.")
			}
			const encodedTxn = this.algoSigner.encoding.msgpackToBase64(encodeObj(txn.txn))
			const mparams = txn.msig as algosdk.EncodedMultisig;
			const version = mparams.v;
			const threshold = mparams.thr;
			const addr = mparams.subsig.map((signData) => {
				return algosdk.encodeAddress(signData.pk)
			});

			const multisigParams = {
				version: version,
				threshold: threshold,
				addrs: addr,
			};

			const signedTxn = await this.signTransaction([
				{
					txn: encodedTxn,
					msig: multisigParams,
					signers: signers,
				},
			]);

			const signedTxnJson = signedTxn[0] as JsonPayload;
			let combineBlob = this.algoSigner.encoding.base64ToMsgpack(signedTxnJson.blob as string)
			// multiple signatures
			if (txn.msig?.subsig.findIndex((item) => item.s?.length) !== -1) {
				const blob1 = encodeObj(txn);
				const blob2 = combineBlob
				combineBlob = algosdk.mergeMultisigTransactions([blob1, blob2]);
			}
			const outputBase64 = this.algoSigner.encoding.msgpackToBase64(combineBlob);
			return {
				blob: outputBase64,
			};
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Execute single transaction or group of transactions (atomic transaction)
	 * Check out {@link https://algobuilder.dev/guide/execute-transaction.html#execute-transaction|execute-transaction}
	 * for more info.
	 * @param transactions transaction parameters, atomic transaction parameters
	 * or TransactionAndSign object(SDK transaction object and signer parameters).
	 * When list of ExecParams is used, the function will request wallet to sign transactions.
	 */
	/* eslint-disable sonarjs/cognitive-complexity */
	async executeTx(transactions: ExecParams[] | TransactionAndSign[]): Promise<TxnReceipt> {
		try {
			let signedTxn: any;
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
				switch (execParams[txnId].sign) {
					case SignType.LogicSignature:
						return { txn: txn, signers: [] }; // logic signature
					case SignType.MultiSignature: {
						const msig: SignWithMultisig = execParams[txnId] as SignWithMultisig;
						return { txn: txn, msig: msig.mparams }; // multi singature
					}
					default:
						return {
							txn: txn,
							authAddr:
								execParams[txnId].fromAccount?.addr || execParams[txnId].fromAccountAddr,
						}; // set signer
				}
			});
			// checks if any sign txn exists else it throws error of empty signers array
			if (toBeSignedTxns.find((txn) => txn.authAddr)) {
				signedTxn = await this.signTransaction(toBeSignedTxns);
			}

			// sign smart signature transaction
			for (const [index, txn] of txns.entries()) {
				const signer: Sign = execParams[index];
				if (signer.sign === SignType.LogicSignature) {
					signer.lsig.lsig.args = signer.args ? signer.args : [];
					const lsigTxn = algosdk.signLogicSigTransaction(txn, signer.lsig);
					if (!Array.isArray(signedTxn)) signedTxn = []; // only logic signature txn are provided
					signedTxn.splice(index, 0, {
						blob: this.algoSigner.encoding.msgpackToBase64(lsigTxn.blob),
						txID: lsigTxn.txID,
					});
				}
			}
			signedTxn = signedTxn?.filter((stxn: any) => stxn);
			const txInfo = await this.sendGroupTransaction(signedTxn);

			if (txInfo && typeof txInfo.txId === "string") {
				return await this.waitForConfirmation(txInfo.txId);
			}
			throw new Error("Transaction Error");
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Creates an algosdk.Transaction object based on execParams and suggestedParams
	 * @param execParams execParams containing all txn info
	 * @param txParams suggestedParams object
	 * @returns array of algosdk.Transaction objects
	 */
	makeTx(execParams: ExecParams[], txParams: algosdk.SuggestedParams): Transaction[] {
		try {
			const txns: Transaction[] = [];
			for (const [_, txn] of execParams.entries()) {
				txns.push(mkTransaction(txn, txParams));
			}
			return txns;
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Signs a Transaction object
	 * @param transaction transaction object.
	 * @returns SignedTransaction
	 */
	async signTx(transaction: algosdk.Transaction): Promise<SignedTransaction> {
		try {
			const binaryTx = transaction.toByte();
			const base64Tx = this.algoSigner.encoding.msgpackToBase64(binaryTx);
			const signedTx = await this.signTransaction([
				{
					txn: base64Tx,
				},
			]);
			const blob = signedTx.blob as string;
			const blobArray = this.algoSigner.encoding.base64ToMsgpack(blob);
			return algosdk.decodeSignedTransaction(blobArray);
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Creates an algosdk.Transaction object based on execParams and suggestedParams
	 * and signs it
	 * @param execParams execParams containing all txn info
	 * @param txParams suggestedParams object
	 * @returns array of algosdk.SignedTransaction objects
	 */
	async makeAndSignTx(
		execParams: ExecParams[],
		txParams: algosdk.SuggestedParams
	): Promise<SignedTransaction[]> {
		try {
			const signedTxns: SignedTransaction[] = [];
			const txns: Transaction[] = this.makeTx(execParams, txParams);
			for (const transaction of txns) {
				const signedTransaction = await this.signTx(transaction);
				signedTxns.push(signedTransaction);
			}
			return signedTxns;
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Sends signedTransaction and waits for the response
	 * @param transactions array of signedTransaction objects.
	 * @param rounds number of rounds to wait for response
	 * @returns TxnReceipt which includes confirmed txn response along with txID
	 */
	async sendTxAndWait(transactions: SignedTransaction[], rounds?: number): Promise<TxnReceipt> {
		try {
			if (transactions.length < 1) {
				throw new Error("No transactions to process");
			} else {
				const txInfo = await this.sendGroupTransaction(transactions);

				if (txInfo && typeof txInfo.txId === "string") {
					return await this.waitForConfirmation(txInfo.txId, rounds);
				}
				throw new Error("Transaction Incorrect");
			}
		} catch (err) {
			error(err);
			throw err;
		}
	}
}
