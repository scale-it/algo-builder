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
        pendingInfo[CONFIRMED_ROUND] as number > 0
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
   * Send transaction to network
   * @param signedTxn signed transaction
   */
  async sendTransaction (signedTxn: any): Promise<JsonPayload> {
    return await this.algoSigner.send({
      ledger: this.chainName,
      tx: signedTxn.blob
    });
  }

  /**
   * Send group transaction to network
   * @param signedTxs signed transaction group
   */
  async sendGroupTransaction (signedTxs: any): Promise<JsonPayload> {
    // The AlgoSigner.signTxn() response would look like '[{ txID, blob }, null]'
    // Convert first transaction to binary from the response
    const signedTxBinary: Uint8Array[] = signedTxs.map((txn: {txID: string, blob: string}) => {
      return this.algoSigner.encoding.base64ToMsgpack(txn.blob);
    });

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
      tx: combinedBase64Txns
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
    s.fee = userParams.totalFee || userParams.feePerByte || txParams["min-fee"] as number; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
    if (s.flatFee) s.fee = Math.max(Number(s.fee), Number(txParams["min-fee"]));

    s.firstRound = userParams.firstValid || s.firstRound; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
    s.lastRound = userParams.firstValid === undefined || userParams.validRounds === undefined // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
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
    let txInfo;
    let txns: Transaction[] = [];
    if (Array.isArray(execParams)) {
      if (execParams.length > 16) { throw new Error("Maximum size of an atomic transfer group is 16"); }

      for (const [_, txn] of execParams.entries()) {
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
      signedTxn = await this.signTransaction(toBeSignedTxns);
      txInfo = await this.sendGroupTransaction(signedTxn);
    } else {
      const txn = await mkTransaction(execParams, await this.getSuggestedParams(execParams.payFlags));

      const toBeSignedTxn = this.algoSigner.encoding.msgpackToBase64(txn.toByte());
      signedTxn = await this.signTransaction([{ txn: toBeSignedTxn }]);
      txInfo = await this.sendTransaction(signedTxn[0]);
    }

    if (txInfo && typeof txInfo.txId === "string") {
      return await this.waitForConfirmation(txInfo.txId);
    }
    throw new Error("Transaction Error");
  }
}
