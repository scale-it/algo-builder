import algosdk, { Account, SignedTransaction, Transaction } from "algosdk";

import { ExecParams, Sign, TransactionAndSign, TxnReceipt } from "../types";

export interface Executor {
	/**
	 * Execute single transaction or group of transactions (atomic transaction)
	 * @param execParams transaction parameters or atomic transaction parameters
	 */
	executeTx(
		transactions: ExecParams[] | TransactionAndSign[] | algosdk.SignedTransaction[],
		debugStack?: number
	): Promise<TxnReceipt> | TxnReceipt | Promise<TxnReceipt[]> | TxnReceipt[];

	/**
	 * Creates an algosdk.Transaction object based on execParams and suggestedParams
	 * @param execParams execParams containing all txn info
	 * @param txParams suggestedParams object
	 * @returns array of algosdk.Transaction objects
	 */
	makeTx(execParams: ExecParams[], txParams: algosdk.SuggestedParams): Transaction[];

	/**
	 * Signes a Transaction object with the provided account
	 * @param transaction transaction object.
	 * @param signer account object that signes the transaction
	 * @returns SignedTransaction
	 */
	signTx(
		transaction: algosdk.Transaction,
		signer?: Account | Sign
	): SignedTransaction | Promise<SignedTransaction>;

	/**
	 * Creates an algosdk.Transaction object based on execParams and suggestedParams
	 * and signs it using provided signer account
	 * @param execParams execParams containing all txn info
	 * @param txParams suggestedParams object
	 * @param signer account object that signes the transaction
	 * @returns array of algosdk.SignedTransaction objects
	 */
	makeAndSignTx(
		execParams: ExecParams[],
		txParams: algosdk.SuggestedParams,
		signer?: Account | Sign
	): SignedTransaction[] | Promise<SignedTransaction[]>;

	/**
	 * Sends signedTransaction and waits for the response
	 * @param transactions array of signedTransaction objects.
	 * @param rounds number of rounds to wait for response
	 * @returns TxnReceipt which includes confirmed txn response along with txID
	 */
	sendTxAndWait(
		transactions: SignedTransaction[],
		rounds?: number
	): Promise<TxnReceipt> | TxnReceipt[];
}
