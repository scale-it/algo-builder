import MyAlgoConnect, { Accounts, Address, SignedTx } from "@randlabs/myalgo-connect";
import algosdk, { Transaction } from "algosdk";

import { mkTxParams } from "..";
import { ExecParams, TransactionInGroup } from "../types";
import { clientForChain } from "./api";
import { mkTransaction } from "./txn";

const CONFIRMED_ROUND = "confirmed-round";
const LAST_ROUND = "last-round";

export class MyAlgoWalletSession {
  readonly connector: MyAlgoConnect;
  private readonly algodClient: algosdk.Algodv2;
  accounts: Accounts[] = [];
  addresses: Address[] = [];

  constructor (chain: string, connector?: MyAlgoConnect) {
    this.algodClient = clientForChain(chain);
    if (connector) {
      this.connector = connector;
    } else {
      this.connector = new MyAlgoConnect();
    }
  }

  // https://connect.myalgo.com/docs/interactive-examples/Connect
  async connectToMyAlgo (): Promise<void> {
    try {
      this.accounts = await this.connector.connect({
        shouldSelectOneAccount: true,
        openManager: true
      });
      this.addresses = this.accounts.map((account) => account.address);
    } catch (err) {
      throw new Error("Error while connecting to my algo wallet");
    }
  }

  /**
   * https://connect.myalgo.com/docs/interactive-examples/PaymentTransaction
   * Sign a single transaction from a my algo wallet session
   * @param txn { SDK transaction object, shouldSign, signers, msig } object
   * @returns raw signed txn
   */
  async signTransaction (txn: algosdk.Transaction): Promise<SignedTx> {
    return await this.connector.signTransaction(txn.toByte());
  }

  /**
   * https://connect.myalgo.com/docs/interactive-examples/GroupedTransaction
   * Sign a group of transaction(s) from a my algo wallet session
   * @param txns { SDK transaction object, shouldSign, signers, msig } object
   * @returns array of raw signed txns | null. null representes that the txn in array is NOT signed
   * by wallet user (i.e signable by someone else).
   */
  async signTransactionGroup (txns: TransactionInGroup[]): Promise<SignedTx[]> {
    const txnsGroup = txns.map((v) => v.txn);
    const groupID = algosdk.computeGroupID(txnsGroup);
    for (let i = 0; i < txns.length; i++) txnsGroup[i].group = groupID;
    return await this.connector.signTransaction(txnsGroup.map((txn) => txn.toByte()));
  }

  /**
   * Send signed transaction to network and wait for confirmation
   * @param rawTxns Signed Transaction(s)
   */
  private async sendAndWait (
    rawTxns: Uint8Array | Uint8Array[]
  ): Promise<algosdk.modelsv2.PendingTransactionResponse> {
    const txInfo = await this.algodClient.sendRawTransaction(rawTxns).do();
    return await this.waitForConfirmation(txInfo.txId);
  }

  // Function used to wait for a tx confirmation
  private async waitForConfirmation (
    txId: string
  ): Promise<algosdk.modelsv2.PendingTransactionResponse> {
    const response = await this.algodClient.status().do();
    let lastround = response[LAST_ROUND];
    while (true) {
      const pendingInfo = await this.algodClient.pendingTransactionInformation(txId).do();
      if (pendingInfo["pool-error"]) {
        throw new Error(`Transaction Pool Error: ${pendingInfo["pool-error"] as string}`);
      }
      if (pendingInfo[CONFIRMED_ROUND] !== null && pendingInfo[CONFIRMED_ROUND] > 0) {
        return pendingInfo as algosdk.modelsv2.PendingTransactionResponse;
      }
      lastround++;
      await this.algodClient.statusAfterBlock(lastround).do();
    }
  }

  /**
   * Execute single transaction or group of transactions (atomic transaction)
   * @param execParams transaction parameters or atomic transaction parameters
   */
  async executeTransaction (
    execParams: ExecParams | ExecParams[]
  ): Promise<algosdk.modelsv2.PendingTransactionResponse> {
    let signedTxn;
    let txns: Transaction[] = [];
    let confirmedTx: algosdk.modelsv2.PendingTransactionResponse;
    if (Array.isArray(execParams)) {
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
      confirmedTx = await this.sendAndWait(Uint8ArraySignedTx);
    } else {
      const txn = mkTransaction(
        execParams,
        await mkTxParams(this.algodClient, execParams.payFlags)
      );
      signedTxn = await this.signTransaction(txn);
      const Uint8ArraySignedTx = signedTxn.blob;
      confirmedTx = await this.sendAndWait(Uint8ArraySignedTx);
    }

    console.log("confirmedTx: ", confirmedTx);
    return confirmedTx;
  }
}
