import algosdk, { SuggestedParams, Transaction } from "algosdk";

import { AlgoSigner, JsonPayload, WalletTransaction } from "../algo-signer-types";
import { ExecParams, isSDKTransactionAndSign, TransactionAndSign, TxParams } from "../types";
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
	async waitForConfirmation(txId: string): Promise<JsonPayload> {
		const response = await this.algoSigner.algod({
			ledger: this.chainName,
			path: "/v2/status",
		});
		log(response);
		let lastround = response[LAST_ROUND] as number;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const pendingInfo = await this.algoSigner.algod({
				ledger: this.chainName,
				path: `/v2/transactions/pending/${txId}`,
			});
			if (
				pendingInfo[CONFIRMED_ROUND] !== null &&
				(pendingInfo[CONFIRMED_ROUND] as number) > 0
			) {
				return pendingInfo;
			}
			// TODO: maybe we should use "sleep" instead of pinging a node again?
			lastround++;
			await this.algoSigner.algod({
				ledger: this.chainName,
				path: `/v2/status/wait-for-block-after/${lastround}`, // eslint-disable-line @typescript-eslint/restrict-template-expressions
			});
		}
	}

	/**
	 * Send transaction to network
	 * @param signedTxn signed transaction
	 */
	async sendTransaction(signedTxn: any): Promise<JsonPayload> {
		return await this.algoSigner.send({
			ledger: this.chainName,
			tx: signedTxn.blob,
		});
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
	 * Execute single transaction or group of transactions (atomic transaction)
	 * @param transactions transaction parameters, atomic transaction parameters
	 * or TransactionAndSign object(SDK transaction object and signer parameters)
	 */
	async executeTx(transactions: ExecParams[] | TransactionAndSign[]): Promise<JsonPayload> {
		let txns: Transaction[] = [];
		if (transactions.length > 16) {
			throw new Error("Maximum size of an atomic transfer group is 16");
		}
		if (!isSDKTransactionAndSign(transactions[0])) {
			const execParams = transactions as ExecParams[];
			for (const [_, txn] of execParams.entries()) {
				txns.push(mkTransaction(txn, await this.getSuggestedParams(txn.payFlags)));
			}
		}
		txns = algosdk.assignGroupID(txns);
		const binaryTxs = txns.map((txn: Transaction) => {
			return txn.toByte();
		});
		const base64Txs = binaryTxs.map((txn: Uint8Array) => {
			return this.algoSigner.encoding.msgpackToBase64(txn);
		});
		const toBeSignedTxns = base64Txs.map((txn: string) => {
			return { txn: txn };
		});
		const signedTxn = await this.signTransaction(toBeSignedTxns);
		const txInfo = await this.sendGroupTransaction(signedTxn);

		if (txInfo && typeof txInfo.txId === "string") {
			return await this.waitForConfirmation(txInfo.txId);
		}
		throw new Error("Transaction Error");
	}
	/** @deprecated */
	async executeTransaction(execParams: ExecParams | ExecParams[]): Promise<JsonPayload> {
		if (Array.isArray(execParams)) return this.executeTx(execParams);
		else return this.executeTx([execParams]);
	}
}
