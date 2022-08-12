import { formatJsonRpcRequest } from "@json-rpc-tools/utils";
import WalletConnect from "@walletconnect/client";
import QRCodeModal from "algorand-walletconnect-qrcode-modal";
import algosdk, { Transaction } from "algosdk";

import { WalletTransaction } from "../algo-signer-types";
import {
	ExecParams,
	HttpNetworkConfig,
	isSDKTransactionAndSign,
	SessionConnectResponse,
	SessionDisconnectResponse,
	SessionUpdateResponse,
	SignTxnParams,
	TransactionAndSign,
	TransactionInGroup,
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
		await this.connector.killSession();
	}

	/**
	 * On connect subscription event
	 * @param handler handler callback
	 */
	onConnect(handler: (error: Error | null, response: SessionConnectResponse) => unknown): void {
		this.connector.on("connect", (err, payload) => {
			const { peerId, peerMeta, accounts }: SessionConnectResponse = payload.params[0];
			this.wcAccounts = accounts;
			handler(err, { peerId, peerMeta, accounts });
		});
	}

	/**
	 * onUpdate subscription event
	 * @param handler handler callback
	 */
	onUpdate(handler: (error: Error | null, response: SessionUpdateResponse) => unknown): void {
		this.connector.on("session_update", (err, payload) => {
			const { accounts }: SessionUpdateResponse = payload.params[0];
			this.wcAccounts = accounts;
			handler(err, { accounts });
		});
	}

	/**
	 * onDisconnect subscription event
	 * @param handler handler callback
	 */
	onDisconnect(
		handler: (error: Error | null, payload: SessionDisconnectResponse) => unknown
	): void {
		this.connector.on("disconnect", (err, payload) => {
			const { message }: SessionDisconnectResponse = payload.params[0];
			handler(err, { message });
		});
	}

	/**
	 * Sign a single transaction from a wallect connect session
	 * @param txn { SDK transaction object, shouldSign, signers, msig } object
	 * @param message optional message with txn
	 * @returns raw signed txn
	 */
	private async signTransaction(
		txn: algosdk.Transaction,
		message?: string
	): Promise<Uint8Array> {
		const txnInGroup: TransactionInGroup = {
			txn,
			shouldSign: true,
		};
		const response = await this.signTransactionGroup([txnInGroup], message);
		if (response[0] == null) {
			throw new Error("Transaction was returned unsigned");
		}
		return response[0];
	}

	/**
	 * Sign a group of transaction(s) from a wallect connect session
	 * @param txn { SDK transaction object, shouldSign, signers, msig } object
	 * @param message optional message with txn
	 * @returns array of raw signed txns | null. null representes that the txn in array is NOT signed
	 * by wallet user (i.e signable by someone else).
	 * TODO: handle case of multiple signers in group transaction
	 */
	async signTransactionGroup(
		txns: TransactionInGroup[],
		message?: string
	): Promise<Array<Uint8Array | null>> {
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
				signers = [];
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
	}

	/**
	 * Send signed transaction to network and wait for confirmation
	 * @param rawTxns Signed Transaction(s)
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 */
	async sendAndWait(
		rawTxns: Uint8Array | Uint8Array[],
		waitRounds = WAIT_ROUNDS
	): Promise<algosdk.modelsv2.PendingTransactionResponse> {
		const txInfo = await this.algodClient.sendRawTransaction(rawTxns).do();
		return await this.waitForConfirmation(txInfo.txId, waitRounds);
	}

	// Function used to wait for a tx confirmation
	private async waitForConfirmation(
		txId: string,
		waitRounds = WAIT_ROUNDS
	): Promise<algosdk.modelsv2.PendingTransactionResponse> {
		const pendingInfo = await algosdk.waitForConfirmation(this.algodClient, txId, waitRounds);
		if (pendingInfo["pool-error"]) {
			throw new Error(`Transaction Pool Error: ${pendingInfo["pool-error"] as string}`);
		}
		return pendingInfo as algosdk.modelsv2.PendingTransactionResponse;
	}

	/**
	 * Execute single transaction or group of transactions (atomic transaction)
	 * @param transactions transaction parameters,  atomic transaction parameters
	 *  or TransactionAndSign object(SDK transaction object and signer parameters)
	 */
	async executeTx(
		transactions: ExecParams[] | TransactionAndSign[]
	): Promise<algosdk.modelsv2.PendingTransactionResponse> {
		let signedTxn;
		let txns: Transaction[] = [];
		if (transactions.length > 16) {
			throw new Error("Maximum size of an atomic transfer group is 16");
		}
		if (!isSDKTransactionAndSign(transactions[0])) {
			const execParams = transactions as ExecParams[];
			for (const [_, txn] of execParams.entries()) {
				txns.push(mkTransaction(txn, await mkTxParams(this.algodClient, txn.payFlags)));
			}
		}
		txns = algosdk.assignGroupID(txns);
		const toBeSignedTxns: TransactionInGroup[] = txns.map((txn: Transaction) => {
			return { txn: txn, shouldSign: true };
		});

		signedTxn = await this.signTransactionGroup(toBeSignedTxns);
		// remove null values from signed txns array
		// TODO: replace null values with "externally" signed txns, otherwise
		// signedtxns with nulls will always fail!
		signedTxn = signedTxn.filter((stxn) => stxn);
		const confirmedTx = await this.sendAndWait(signedTxn as Uint8Array[]);

		log("confirmedTx: ", confirmedTx);
		return confirmedTx;
	}
}
