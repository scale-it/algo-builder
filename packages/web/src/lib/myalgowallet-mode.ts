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
import algosdk, { SignedTransaction, Transaction } from "algosdk";
import { LogicSig } from "algosdk/dist/types/src/logicsig";

import { mkTxParams } from "..";
import {
	ExecParams,
	HttpNetworkConfig,
	isSDKTransactionAndSign,
	Sign,
	SignType,
	TransactionInGroup,
	TxnReceipt,
} from "../types";
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
			throw err;
		}
	}

	/**
	 * @async
	 * @description Sign a teal program (https://algorand.github.io/js-algorand-sdk/modules.html#tealSign)
	 * @param logic Teal program
	 * @param address Signer Address
	 * @returns Returns signed teal
	 * for more info: https://connect.myalgo.com/docs/interactive-examples/TealSign
	 */
	async signLogicSigUsingTeal(logic: string | Uint8Array, address: string): Promise<Uint8Array> {
		try {
			return await this.connector.signLogicSig(logic, address)
		} catch (err) {
			error(err);
			throw new Error("Error while signing teal program" + err);
		}
	}

	/**
	 * @description Sign a Logic Signature transaction
	 * @param transaction algosdk.Transaction object
	 * @param logicSig Logic Sig Account
	 * @returns Returns txID and blob object
	 */
	signLogicSig(transaction: Transaction, logicSig: LogicSig): { txID: string, blob: Uint8Array } {
		try {
			return algosdk.signLogicSigTransaction(transaction, logicSig)
		} catch (err) {
			error(err);
			throw new Error("Error while signing Lsig Transaction" + err);
		}
	}

	/**
	 * @async
	 * @description Connects to the MyAlgo Wallet by opening up its dialog box to login
	 * @param allowMultipleAccounts allow selection of multiple accounts from MyAlgo Wallet, default is true
	 * For Multisig you need to allow multiple accounts login
	 * for more info visit: https://connect.myalgo.com/docs/interactive-examples/Connect
	 */
	async connectToMyAlgo(allowMultipleAccounts = true): Promise<void> {
		try {
			this.accounts = await this.connector.connect({
				shouldSelectOneAccount: !allowMultipleAccounts,
				openManager: true,
			});
			this.addresses = this.accounts.map((account) => account.address);
		} catch (err) {
			error(err);
			throw new Error("Error while connecting to MyAlgo Wallet" + err);
		}
	}

	/**
	 * https://connect.myalgo.com/docs/interactive-examples/PaymentTransaction
	 * Sign a single transaction from a my algo wallet session
	 * @param txn { SDK transaction object, shouldSign, signers, msig } object
	 * @returns raw signed txn
	 */
	async signTransaction(
		txn: algosdk.Transaction,
		signOptions?: SignTransactionOptions
	): Promise<SignedTx> {
		try {
			return await this.connector.signTransaction(txn.toByte(), signOptions);
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * https://connect.myalgo.com/docs/interactive-examples/GroupedTransaction
	 * Sign a group of transaction(s) from a my algo wallet session
	 * @param txns { SDK transaction object, shouldSign, signers, msig } object
	 * @returns array of raw signed txns | null. null representes that the txn in array is NOT signed
	 * by wallet user (i.e signable by someone else).
	 */
	async signTransactionGroup(
		txns: TransactionInGroup[],
		signOptions?: SignTransactionOptions
	): Promise<SignedTx[]> {
		try {
			const txnsGroup = txns.map((v) => v.txn);
			const groupID = algosdk.computeGroupID(txnsGroup);
			for (let i = 0; i < txns.length; i++) {
				// called from executeTx where groupID is already assigned
				if (!txnsGroup[i].group) {
					txnsGroup[i].group = groupID;
				}
			}
			return await this.connector.signTransaction(
				txnsGroup.map((txn) => txn.toByte()),
				signOptions
			);
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
	 * @param execParams transaction parameters or atomic transaction parameters
	 */
	async executeTx(execParams: ExecParams[]): Promise<TxnReceipt> {
		try {
			let signedTxn: SignedTx[] | undefined;
			let txns: Transaction[] = [];
			if (execParams.length > 16) {
				throw new Error("Maximum size of an atomic transfer group is 16");
			}

			if (isSDKTransactionAndSign(execParams[0]))
				throw new Error("We don't support this case now");

			for (const [_, txn] of execParams.entries()) {
				txns.push(mkTransaction(txn, await mkTxParams(this.algodClient, txn.payFlags)));
			}

			txns = algosdk.assignGroupID(txns);

			// with logic signature we set shouldSign to false
			const toBeSignedTxns: TransactionInGroup[] = execParams.map(
				(txn: ExecParams, index: number) => {
					return txn.sign === SignType.LogicSignature
						? { txn: txns[index], shouldSign: false } // logic signature
						: { txn: txns[index], shouldSign: true }; // to be signed
				}
			);
			// only shouldSign txn are to be signed, algowallet doesn't accept lsig ones
			const nonLsigTxn = toBeSignedTxns.filter((txn) => txn.shouldSign);
			if (nonLsigTxn.length) {
				signedTxn = await this.signTransactionGroup(nonLsigTxn);
			}
			// sign smart signature transaction
			for (const [index, txn] of txns.entries()) {
				const signer: Sign = execParams[index];
				if (signer.sign === SignType.LogicSignature) {
					signer.lsig.lsig.args = signer.args ? signer.args : [];
					if (!Array.isArray(signedTxn)) signedTxn = [];
					signedTxn.splice(index, 0, algosdk.signLogicSigTransaction(txn, signer.lsig));
				}
			}

			signedTxn = signedTxn?.filter((stxn) => stxn);
			const Uint8ArraySignedTx = signedTxn?.map((stxn) => stxn.blob);
			const confirmedTx = await this.sendAndWait(Uint8ArraySignedTx as Uint8Array[]);

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
	 * Signs a Transaction object with with myAlgoWallet
	 * @param transaction transaction object.
	 * @returns SignedTransaction
	 */
	async signTx(transaction: algosdk.Transaction): Promise<SignedTransaction> {
		try {
			const signedTx = await this.connector.signTransaction(transaction.toByte());
			const blob = signedTx.blob;
			return algosdk.decodeSignedTransaction(blob);
		} catch (err) {
			error(err);
			throw err;
		}
	}

	/**
	 * Creates an algosdk.Transaction object based on execParams and suggestedParams
	 * and signs with myAlgoWallet
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
				const Uint8ArraySignedTx = transactions.map((txn) => algosdk.encodeObj(txn));
				return await this.sendAndWait(Uint8ArraySignedTx, rounds);
			}
		} catch (err) {
			error(err);
			throw err;
		}
	}
}
