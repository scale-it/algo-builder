import type {
	Accounts,
	Address,
	AlgorandTxn,
	Base64,
	ConnectionSettings,
	EncodedTransaction,
	SignedTx,
	SignTransactionOptions,
} from "@randlabs/myalgo-connect";
import algosdk, { Transaction } from "algosdk";

import { mkTxParams } from "..";
import { ExecParams, HttpNetworkConfig, TransactionInGroup } from "../types";
import { algoexplorerAlgod } from "./api";
import { WAIT_ROUNDS } from "./constants";
import { error, log } from "./logger";
import { mkTransaction } from "./txn";

interface MyAlgoConnect {
	/**
	 * @async
	 * @description Receives user's accounts from MyAlgo.
	 * @param {ConnectionSettings} [settings] Connection settings
	 * @returns Returns an array of Algorand addresses.
	 */
	connect(settings?: ConnectionSettings): Promise<Accounts[]>;

	/**
	 * @async
	 * @description Sign an Algorand Transaction.
	 * @param transaction Expect a valid Algorand transaction
	 * @param signOptions Sign transactions options object.
	 * @returns Returns signed transaction
	 */
	signTransaction(transaction: AlgorandTxn | EncodedTransaction, 
		signOptions?: SignTransactionOptions): Promise<SignedTx>;

	/**
	 * @async
	 * @description Sign an Algorand Transaction.
	 * @param transaction Expect a valid Algorand transaction array.
	 * @param signOptions Sign transactions options object.
	 * @returns Returns signed an array of signed transactions.
	 */
	signTransaction(transaction: (AlgorandTxn | EncodedTransaction)[], 
		signOptions?: SignTransactionOptions): Promise<SignedTx[]>;

	/**
	 * @async
	 * @description Sign a teal program
	 * @param logic Teal program
	 * @param address Signer Address
	 * @returns Returns signed teal
	 */
	signLogicSig(logic: Uint8Array | Base64, address: Address): Promise<Uint8Array>;
}

export class MyAlgoWalletSession {
	connector!: MyAlgoConnect;
	private readonly algodClient: algosdk.Algodv2;
	accounts: Accounts[] = [];
	addresses: Address[] = [];

	constructor(walletURL: HttpNetworkConfig, connector?: MyAlgoConnect) {
		this.algodClient = algoexplorerAlgod(walletURL);
		try {
			const MyAlgoConnect = require("@randlabs/myalgo-connect"); // eslint-disable-line @typescript-eslint/no-var-requires
			if (connector) {
				this.connector = connector;
			} else {
				this.connector = new MyAlgoConnect();
			}
		} catch (err) {
			error(err);
		}
	}

	// https://connect.myalgo.com/docs/interactive-examples/Connect
	async connectToMyAlgo(): Promise<void> {
		try {
			this.accounts = await this.connector.connect({
				shouldSelectOneAccount: true,
				openManager: true,
			});
			this.addresses = this.accounts.map((account) => account.address);
		} catch (err) {
			throw new Error("Error while connecting to MyAlgo Wallet");
		}
	}

	/**
	 * https://connect.myalgo.com/docs/interactive-examples/PaymentTransaction
	 * Sign a single transaction from a my algo wallet session
	 * @param txn { SDK transaction object, shouldSign, signers, msig } object
	 * @returns raw signed txn
	 */
	async signTransaction(txn: algosdk.Transaction, signOptions?: SignTransactionOptions): Promise<SignedTx> {
		return await this.connector.signTransaction(txn.toByte(), signOptions);
	}

	/**
	 * https://connect.myalgo.com/docs/interactive-examples/GroupedTransaction
	 * Sign a group of transaction(s) from a my algo wallet session
	 * @param txns { SDK transaction object, shouldSign, signers, msig } object
	 * @returns array of raw signed txns | null. null representes that the txn in array is NOT signed
	 * by wallet user (i.e signable by someone else).
	 */
	async signTransactionGroup(txns: TransactionInGroup[], 
		signOptions?: SignTransactionOptions): Promise<SignedTx[]> {
		const txnsGroup = txns.map((v) => v.txn);
		const groupID = algosdk.computeGroupID(txnsGroup);
		for (let i = 0; i < txns.length; i++) txnsGroup[i].group = groupID;
		return await this.connector.signTransaction(txnsGroup.map((txn) => txn.toByte()), signOptions);
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
	 * @param execParams transaction parameters or atomic transaction parameters
	 */
	async executeTx(
		execParams: ExecParams[]
	): Promise<algosdk.modelsv2.PendingTransactionResponse> {
		let signedTxn;
		let txns: Transaction[] = [];
		if (execParams.length > 16) {
			throw new Error("Maximum size of an atomic transfer group is 16");
		}
		for (const [_, txn] of execParams.entries()) {
			txns.push(mkTransaction(txn, await mkTxParams(this.algodClient, txn.payFlags)));
		}

		txns = algosdk.assignGroupID(txns);
		const toBeSignedTxns: TransactionInGroup[] = txns.map((txn: Transaction) => {
			return { txn: txn, shouldSign: true };
		});

		signedTxn = await this.signTransactionGroup(toBeSignedTxns);

		signedTxn = signedTxn.filter((stxn) => stxn);
		const Uint8ArraySignedTx = signedTxn.map((stxn) => stxn.blob);
		const confirmedTx = await this.sendAndWait(Uint8ArraySignedTx);

		log("confirmedTx: ", confirmedTx);
		return confirmedTx;
	}
}
