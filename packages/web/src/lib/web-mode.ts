import algosdk, { SuggestedParams, Transaction } from "algosdk";

import { AlgoSigner, JsonPayload, WalletTransaction } from "../algo-signer-types";
import { ExecParams, TxParams } from "../types";
import { mkTransaction } from "./txn";

const CONFIRMED_ROUND = "confirmed-round";
const LAST_ROUND = "last-round";

export class WebMode {
  algoSigner: AlgoSigner;
  chainName: string;

  constructor (algoSigner: AlgoSigner, chainName: string) {
    this.algoSigner = algoSigner;
    this.chainName = chainName;
  }

  /**
   * wait for confirmation for transaction using transaction id
   * @param txId Transaction id
   */
  async waitForConfirmation (txId: string): Promise<JsonPayload> {
    const response = await this.algoSigner.algod({
      ledger: this.chainName,
      path: '/v2/status'
    });
    console.log(response);
    let lastround = response[LAST_ROUND] as number;
    while (true) {
      const pendingInfo = await this.algoSigner.algod({
        ledger: this.chainName,
        path: `/v2/transactions/pending/${txId}`
      });
      if (
        pendingInfo[CONFIRMED_ROUND] !== null &&
        pendingInfo[CONFIRMED_ROUND] > 0
      ) {
        return pendingInfo;
      }
      lastround++;
      await this.algoSigner.algod({
        ledger: this.chainName,
        path: `/v2/status/wait-for-block-after/${lastround}`// eslint-disable-line @typescript-eslint/restrict-template-expressions
      });
    }
  }

  /**
   * Sender transaction to network
   * @param signedTxn signed transaction
   */
  async sendTransaction (signedTxn: any): Promise<JsonPayload> {
    return await this.algoSigner.send({
      ledger: this.chainName,
      tx: signedTxn.blob
    });
  }

  /**
   * Sign transaction using algosigner
   * @param txns Array of transactions in base64
   */
  async signTransaction (txns: WalletTransaction[]): Promise<JsonPayload> {
    return await this.algoSigner.signTxn(txns);
  }

  /**
   * Returns suggested transaction parameters using algosigner
   * @param userParams Transaction parameters
   */
  async getSuggestedParams (userParams: TxParams): Promise<SuggestedParams> {
    const txParams = await this.algoSigner.algod({
      ledger: this.chainName,
      path: '/v2/transactions/params'
    });
    const s: SuggestedParams = {
      fee: txParams.fee as number,
      genesisHash: txParams["genesis-hash"] as string,
      genesisID: txParams["genesis-id"] as string,
      firstRound: txParams[LAST_ROUND] as number,
      lastRound: Number(txParams[LAST_ROUND]) + 1000,
      flatFee: false
    };

    s.flatFee = userParams.totalFee !== undefined;
    s.fee = userParams.totalFee ?? userParams.feePerByte ?? txParams["min-fee"] as number;
    if (s.flatFee) s.fee = Math.max(Number(s.fee), Number(txParams["min-fee"]));

    s.firstRound = userParams.firstValid ?? s.firstRound;
    s.lastRound = userParams.firstValid === undefined || userParams.validRounds === undefined
      ? s.lastRound
      : Number(userParams.firstValid) + Number(userParams.validRounds);

    return s;
  }

  /**
 * Execute single transaction or group of transactions (atomic transaction)
 * @param execParams transaction parameters or atomic transaction parameters
 */
  async executeTransaction (execParams: ExecParams | ExecParams[]):
  Promise<JsonPayload> {
    let signedTxn;
    let txns: Transaction[] = [];
    if (Array.isArray(execParams)) {
      if (execParams.length > 16) { throw new Error("Maximum size of an atomic transfer group is 16"); }

      for (const [idx, txn] of execParams.entries()) {
        txns.push(await mkTransaction(txn, await this.getSuggestedParams(txn.payFlags)));
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
      signedTxn = this.signTransaction(toBeSignedTxns);
    } else {
      const txn = await mkTransaction(execParams, await this.getSuggestedParams(execParams.payFlags));

      const toBeSignedTxn = this.algoSigner.encoding.msgpackToBase64(txn.toByte());
      signedTxn = this.signTransaction([{ txn: toBeSignedTxn }]);
    }

    const txInfo = await this.sendTransaction(signedTxn);
    if (typeof txInfo.txId === "string") {
      return await this.waitForConfirmation(txInfo.txId);
    }
    throw new Error("");
  }
}
