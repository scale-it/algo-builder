import { formatJsonRpcRequest } from "@json-rpc-tools/utils";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "algorand-walletconnect-qrcode-modal";
import algosdk, { SignedTransaction, Transaction } from "algosdk";

import { WalletTransaction } from "../algo-signer-types";
import {
	ExecParams,
	HttpNetworkConfig,
	isSDKTransactionAndSign,
	SessionConnectResponse,
	SessionDisconnectResponse,
	SessionUpdateResponse,
	Sign,
	SignTxnParams,
	SignType,
	TransactionAndSign,
	TransactionInGroup,
	TxnReceipt,
} from "../types";
import { algoexplorerAlgod, mkTxParams } from "./api";
import { ALGORAND_SIGN_TRANSACTION_REQUEST, WAIT_ROUNDS } from "./constants";
import { error, log, warn } from "./logger";
import { mkTransaction } from "./txn";

export class WallectConnectSession {
	readonly connector: WalletConnect;
	private readonly algodClient: algosdk.Algodv2;
	wcAccounts: string[];

	constructor(walletURL: HttpNetworkConfig, connector?: WalletConnect) {
		this.algodClient = algoexplorerAlgod(walletURL);
		if (connector) {
			this.connector = connector;
		} else {
			// create new session
			this.connector = new WalletConnect({
				bridge: "https://bridge.walletconnect.org", // Required
				qrcodeModal: QRCodeModal,
			});
		}

		// if connection not already established, log message to create one
		if (!this.connector.connected) {
			warn(`Connection not established, please use "this.create()" to create new session`);
		}
		this.wcAccounts = this.connector.accounts;
	}

	/**
	 * Create new session
	 * @param force if true, kills an existing session and creates new one.
	 * By default force is false
	 */
	async create(force = false): Promise<void> {
		if (this.connector.connected) {
			if (force) {
				try {
					await this.close();
				} catch (e) {
					error("Can't close walletconnect connection", e);
					throw e;
				}
			} else {
				warn(`A session is already active`);
				return;
			}
		}
		await this.connector.createSession();
	}

	/**
	 * Close Connection
	 */
	async close(): Promise<void> {
		try {
			await this.connector.killSession();
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * On connect subscription event
	 * @param handler handler callback
	 */
	onConnect(handler: (error: Error | null, response: SessionConnectResponse) => unknown): void {
		try {
			this.connector.on("connect", (err, payload) => {
				const { peerId, peerMeta, accounts }: SessionConnectResponse = payload.params[0];
				this.wcAccounts = accounts;
				handler(err, { peerId, peerMeta, accounts });
			});
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * onUpdate subscription event
	 * @param handler handler callback
	 */
	onUpdate(handler: (error: Error | null, response: SessionUpdateResponse) => unknown): void {
		try {
			this.connector.on("session_update", (err, payload) => {
				const { accounts }: SessionUpdateResponse = payload.params[0];
				this.wcAccounts = accounts;
				handler(err, { accounts });
			});
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * onDisconnect subscription event
	 * @param handler handler callback
	 */
	onDisconnect(
		handler: (error: Error | null, payload: SessionDisconnectResponse) => unknown
	): void {
		try {
			this.connector.on("disconnect", (err, payload) => {
				const { message }: SessionDisconnectResponse = payload.params[0];
				handler(err, { message });
			});
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Sign a single transaction from a wallect connect session
	 * @param txn { SDK transaction object, shouldSign, signers, msig } object
	 * @param message optional message with txn
	 * @returns raw signed txn
	 */
	async signTransaction(txn: algosdk.Transaction, message?: string): Promise<Uint8Array> {
		try {
			const txnInGroup: TransactionInGroup = {
				txn,
				shouldSign: true,
				signers: txn.from as unknown as string,
			};
			const response = await this.signTransactionGroup([txnInGroup], message);
			if (response[0] == null) {
				throw new Error("Transaction was returned unsigned");
			}
			return response[0];
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * @description Signs a Logic Signature transaction
	 * @param transaction algosdk.Transaction object
	 * @param logicSig Logic Sig Account
	 * @returns Returns txID and blob object
	 */
	signLogicSignatureTxn(transaction: Transaction, logicSig: algosdk.LogicSigAccount): { txID: string, blob: Uint8Array } {
		try {
			return algosdk.signLogicSigTransaction(transaction, logicSig)
		} catch (err) {
			error(err);
			throw new Error("Error while signing Lsig Transaction" + err);
		}
	}

	/**
	 * Sign a group of transaction(s) from a wallect connect session
	 * @param txns Array of [{  SDK transaction object, shouldSign, signers, msig }] object
	 * @param message optional message with txn
	 * @returns array of raw signed txns | null. null representes that the txn in array is NOT signed
	 * by wallet user (i.e signable by someone else).
	 * TODO: handle case of multiple signers in group transaction
	 */
	async signTransactionGroup(
		txns: TransactionInGroup[],
		message?: string
	): Promise<Array<Uint8Array | null>> {
		try {
			const walletTxns: WalletTransaction[] = txns.map((txn) => {
				const encodedTxn = Buffer.from(algosdk.encodeUnsignedTransaction(txn.txn)).toString(
					"base64"
				);
				let signers: string[] | undefined;
				if (txn.shouldSign) {
					if (Array.isArray(txn.signers)) {
						signers = txn.signers;
					} else if (txn.signers) {
						signers = [txn.signers];
					} else {
						signers = undefined;
					}
				} else {
					signers = undefined;
				}

				return {
					signers,
					txn: encodedTxn,
					message: txn.message,
					msig: txn.msig,
				};
			});

			const requestParams: SignTxnParams = [walletTxns];
			log("requestParams ", requestParams);

			if (message) {
				requestParams.push({ message });
			}
			const request = formatJsonRpcRequest(ALGORAND_SIGN_TRANSACTION_REQUEST, requestParams);
			const result: Array<string | null> = await this.connector.sendCustomRequest(request);

			return result.map((element) => {
				return element ? new Uint8Array(Buffer.from(element, "base64")) : null;
			});
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Send signed transaction to network and wait for confirmation
	 * @param rawTxns Signed Transaction(s)
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 * @returns TxnReceipt which includes confirmed txn response along with txID
	 */
	async sendAndWait(
		rawTxns: Uint8Array | Uint8Array[],
		waitRounds = WAIT_ROUNDS
	): Promise<TxnReceipt> {
		try {
			const txInfo = await this.algodClient.sendRawTransaction(rawTxns).do();
			return await this.waitForConfirmation(txInfo.txId, waitRounds);
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Function used to wait for a tx confirmation
	 * @param txId txn ID for which confirmation is required
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 * @returns TxnReceipt which includes confirmed txn response along with txID
	 */
	async waitForConfirmation(txId: string, waitRounds = WAIT_ROUNDS): Promise<TxnReceipt> {
		try {
			const pendingInfo = await algosdk.waitForConfirmation(this.algodClient, txId, waitRounds);
			if (pendingInfo["pool-error"]) {
				throw new Error(`Transaction Pool Error: ${pendingInfo["pool-error"] as string}`);
			}
			const txnReceipt = { txID: txId, ...pendingInfo };
			return txnReceipt as TxnReceipt;
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Execute single transaction or group of transactions (atomic transaction)
	 * @param transactions transaction parameters,  atomic transaction parameters
	 *  or TransactionAndSign object(SDK transaction object and signer parameters)
	 */
	/* eslint-disable sonarjs/cognitive-complexity */
	async executeTx(transactions: ExecParams[] | TransactionAndSign[]): Promise<TxnReceipt> {
		try {
			let signedTxn: (Uint8Array | null)[] | undefined;
			let txns: Transaction[] = [];
			if (transactions.length > 16) {
				throw new Error("Maximum size of an atomic transfer group is 16");
			}
			if (isSDKTransactionAndSign(transactions[0])) {
				throw new Error("We don't support this case now");
			}

			const execParams = transactions as ExecParams[];
			for (const [_, txn] of execParams.entries()) {
				txns.push(mkTransaction(txn, await mkTxParams(this.algodClient, txn.payFlags)));
			}

			txns = algosdk.assignGroupID(txns);

			// with logic signature we set shouldSign to false
			const toBeSignedTxns: TransactionInGroup[] = execParams.map(
				(txn: ExecParams, index: number) => {
					return txn.sign === SignType.LogicSignature
						? { txn: txns[index], shouldSign: false } // logic signature
						: {
							txn: txns[index],
							shouldSign: true,
							signers:
								execParams[index].fromAccount?.addr || execParams[index].fromAccountAddr,
						}; // to be signed
				}
			);
			// only shouldSign txn are to be signed
			const nonLsigTxn = toBeSignedTxns.filter((txn) => txn.shouldSign);
			if (nonLsigTxn.length > 0) {
				signedTxn = await this.signTransactionGroup(toBeSignedTxns);
			}
			// sign smart signature transaction
			for (const [index, txn] of txns.entries()) {
				const signer: Sign = execParams[index];
				if (signer.sign === SignType.LogicSignature) {
					signer.lsig.lsig.args = signer.args ? signer.args : [];
					if (!Array.isArray(signedTxn)) signedTxn = [];
					signedTxn.splice(index, 0, this.signLogicSignatureTxn(txn, signer.lsig).blob);
				}
			}

			// remove null values from signed txns array
			// TODO: replace null values with "externally" signed txns, otherwise
			// signedtxns with nulls will always fail!
			signedTxn = signedTxn?.filter((stxn) => stxn);
			const confirmedTx = await this.sendAndWait(signedTxn as Uint8Array[]);

			log("confirmedTx: ", confirmedTx);
			return confirmedTx;
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
	 * Signes a Transaction object using walletconnect
	 * @param transaction transaction object.
	 * @returns SignedTransaction
	 */
	async signTx(transaction: algosdk.Transaction): Promise<SignedTransaction> {
		try {
			const txns = [transaction];
			const txnsToSign = txns.map((txn) => {
				const encodedTxn = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
					"base64"
				);
				return { txn: encodedTxn };
			});
			const requestParams = [txnsToSign];
			const request = formatJsonRpcRequest(ALGORAND_SIGN_TRANSACTION_REQUEST, requestParams);
			const result: Array<string | null> = await this.connector.sendCustomRequest(request);
			const decodedResult = result.map((element) => {
				return element ? new Uint8Array(Buffer.from(element, "base64")) : null;
			});
			if (decodedResult[0] === null) {
				throw new Error("Transaction was returned unsigned");
			}
			return algosdk.decodeSignedTransaction(decodedResult[0]);
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Creates an algosdk.Transaction object based on execParams and suggestedParams
	 * and signs it using walletconnect
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
				throw Error("No transactions to process");
			} else {
				const Uint8ArraySignedTx = transactions.map((txn) => algosdk.encodeObj(txn));
				return await this.sendAndWait(Uint8ArraySignedTx, rounds);
			}
		} catch (err) {
			error(err);
			throw err;
		}
	}
}
