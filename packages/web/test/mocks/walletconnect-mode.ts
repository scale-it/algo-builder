import algosdk, { SignedTransaction, Transaction } from "algosdk";
import { algoexplorerAlgod } from "../../src/lib/api";
import { ExecParams, HttpNetworkConfig, TransactionAndSign, TxnReceipt, WAIT_ROUNDS } from "../../src/types";
import { encodedTxnObject, mockSuggestedParam } from './tx'
import { mkTransaction } from "../../src/lib/txn";

export default class WallectConnectSessionMock {
    private readonly algodClient: algosdk.Algodv2;

    constructor(walletURL: HttpNetworkConfig) {
        this.algodClient = algoexplorerAlgod(walletURL);
    }

    /**
      * Execute single transaction or group of transactions (atomic transaction)
      * @param transactions transaction parameters,  atomic transaction parameters
      *  or TransactionAndSign object(SDK transaction object and signer parameters)
      */
    async executeTx(transactions: ExecParams[] | TransactionAndSign[]): Promise<TxnReceipt> {
        return {
            txID: "1",
            "confirmed-round": 1,
            "asset-index": 1,
            "application-index": 1,
            txn: {
                txn: encodedTxnObject,
            },
        };
    }

    /**
     * Creates an algosdk.Transaction object based on execParams and suggestedParams
     * @param execParams execParams containing all txn info
     * @param txParams suggestedParams object
     * @returns array of algosdk.Transaction objects
     */
    makeTx(execParams: ExecParams[], txParams: algosdk.SuggestedParams): Transaction[] {
        const txns = []
        for (const execParam of execParams) {
            txns.push(mkTransaction(execParam, mockSuggestedParam))
        }
        return txns
    }

    /**
     * Signes a Transaction object using walletconnect
     * @param transaction transaction object.
     * @returns SignedTransaction
     */
    async signTx(transaction: algosdk.Transaction): Promise<SignedTransaction> {
        return algosdk.decodeSignedTransaction(Buffer.alloc(0));
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
        const signedTxns: SignedTransaction[] = [];
        const txns: Transaction[] = this.makeTx(execParams, txParams);
        txns.forEach(async (txn) => signedTxns.push(await this.signTx(txn)));
        return signedTxns;
    }

    /**
     * Sends signedTransaction and waits for the response
     * @param transactions array of signedTransaction objects.
     * @param rounds number of rounds to wait for response
     * @returns TxnReceipt which includes confirmed txn response along with txID
     */
    async sendTxAndWait(transactions: SignedTransaction[], rounds?: number): Promise<TxnReceipt> {
        if (transactions.length < 1) {
            throw Error("No transactions to process");
        } else {
            const Uint8ArraySignedTx = transactions.map((txn) => algosdk.encodeObj(txn));
            return await this.sendAndWait(Uint8ArraySignedTx, rounds);
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
        const txInfo = await this.algodClient.sendRawTransaction(rawTxns).do();
        return await this.waitForConfirmation(txInfo.txId, waitRounds);
    }

    /**
    * Function used to wait for a tx confirmation
    * @param txId txn ID for which confirmation is required 
    * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
    * @returns TxnReceipt which includes confirmed txn response along with txID
    */
    async waitForConfirmation(
        txId: string,
        waitRounds = WAIT_ROUNDS
    ): Promise<TxnReceipt> {
        const pendingInfo = await algosdk.waitForConfirmation(this.algodClient, txId, waitRounds);
        if (pendingInfo["pool-error"]) {
            throw new Error(`Transaction Pool Error: ${pendingInfo["pool-error"] as string}`);
        }
        const txnReceipt = { txID: txId, ...pendingInfo };
        return txnReceipt as TxnReceipt;
    }

}