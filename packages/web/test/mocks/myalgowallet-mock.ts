import type {
	Accounts,
	Address,
	AlgorandTxn,
	Base64,
	ConnectionSettings,
	EncodedTransaction,
	SignedTx,
	SignTransactionOptions,
	SignTxnsOpts,
	WalletTransaction,
} from "@randlabs/myalgo-connect";
import MyAlgoConnect from "@randlabs/myalgo-connect";
import algosdk, { decodeUnsignedTransaction } from "algosdk";

import { senderAccount } from "./tx";

export class MyAlgoConnectMock implements MyAlgoConnect {
	/**
	 * @async
	 * @description Receives user's accounts from MyAlgo.
	 * @param {ConnectionSettings} [settings] Connection settings
	 * @returns Returns an array of Algorand addresses.
	 */
	connect(settings?: ConnectionSettings): Promise<Accounts[]> {
		return new Promise((resolve, reject) => {
			return resolve([
				{
					address: "",
					name: "",
				},
			]);
		});
	}

	/**
	 * @async
	 * @description Sign an Algorand Transaction.
	 * @param transaction Expect a valid Algorand transaction
	 * @param signOptions Sign transactions options object.
	 * @returns Returns signed transaction
	 */
	signTransaction(
		transaction: AlgorandTxn | EncodedTransaction,
		signOptions?: SignTransactionOptions
	): Promise<SignedTx>;

	/**
	 * @async
	 * @description Sign an Algorand Transaction.
	 * @param transaction Expect a valid Algorand transaction array.
	 * @param signOptions Sign transactions options object.
	 * @returns Returns signed an array of signed transactions.
	 */
	signTransaction(
		transaction: (AlgorandTxn | EncodedTransaction)[],
		signOptions?: SignTransactionOptions
	): Promise<SignedTx[]>;

	signTransaction(
		transaction: AlgorandTxn | EncodedTransaction | (AlgorandTxn | EncodedTransaction)[],
		signOptions?: SignTransactionOptions
	): Promise<SignedTx | SignedTx[]> {
		return new Promise((resolve, reject) => {
			if (Array.isArray(transaction)) {
				const signedTransaction = [];
				for (const txn of transaction) {
					const decodedtransaction = decodeUnsignedTransaction(txn as Uint8Array);
					signedTransaction.push(algosdk.signTransaction(decodedtransaction, senderAccount.sk));
				}
				return resolve(signedTransaction);
			} else {
				const decodedtransaction = decodeUnsignedTransaction(transaction as Uint8Array);
				return resolve(algosdk.signTransaction(decodedtransaction, senderAccount.sk));
			}
		});
	}

	/**
	 * @async
	 * @description Sign a teal program
	 * @param logic Teal program
	 * @param address Signer Address
	 * @returns Returns signed teal
	 */
	signLogicSig(logic: Uint8Array | Base64, address: Address): Promise<Uint8Array> {
		return emptyPromise();
	}

	/**
	 * @async
	 * @description Creates a signature the data that can later be verified by the contract through the
	 * ed25519verify opcode
	 * @param data Arbitrary data to sign
	 * @param contractAddress Contract address/TEAL program hash
	 * @param address Signer Address
	 * @returns Returns the data signature
	 */
	tealSign(
		data: Uint8Array | Base64,
		contractAddress: Address,
		address: Address
	): Promise<Uint8Array> {
		return emptyPromise();
	}

	signTxns(
		txns: WalletTransaction[],
		opts?: SignTxnsOpts | undefined
	): Promise<(string | null)[]> {
		return new Promise((resolve, reject) => {
			return resolve([null]);
		});
	}

	signBytes(bytes: Uint8Array, address: string): Promise<Uint8Array> {
		return emptyPromise();
	}
}

function emptyPromise(): Promise<Uint8Array> {
	return new Promise((resolve, _) => resolve(new Uint8Array()));
}
