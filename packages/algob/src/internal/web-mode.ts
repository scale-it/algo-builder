import { mkTransaction, types as rtypes } from "@algo-builder/runtime";
import { ConfirmedTxInfo, SuggestedParams, Transaction } from "algosdk";

import { AlgoSigner, AlgoSignerSendTx, AlgoSignerSignedTx, AlgoSignerToBeSignedTx } from "../types";

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
  async waitForConfirmation (txId: string): Promise<ConfirmedTxInfo> {
    const response = await this.algoSigner.algod({
      ledger: this.chainName,
      path: '/v2/status'
    });
    console.log(response);
    let lastround = response[LAST_ROUND];
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
  async sendTransaction (signedTxn: any): Promise<AlgoSignerSendTx> {
    return this.algoSigner.send({
      ledger: this.chainName,
      tx: signedTxn.blob
    });
  }

  /**
   * Sign transaction using algosigner
   * @param txns Array of transactions in base64
   */
  async signTransaction (txns: AlgoSignerToBeSignedTx[]): Promise<AlgoSignerSignedTx> {
    return this.algoSigner.signTxn(txns);
  }

  /**
   * Returns suggested transaction parameters using algosigner
   * @param userParams Transaction parameters
   */
  async getSuggestedParams (userParams: rtypes.TxParams): Promise<SuggestedParams> {
    const txParams = await this.algoSigner.algod({
      ledger: this.chainName,
      path: '/v2/transactions/params'
    });
    const s: SuggestedParams = {
      fee: txParams.fee,
      genesisHash: txParams["genesis-hash"],
      genesisID: txParams["genesis-id"],
      firstRound: txParams[LAST_ROUND],
      lastRound: Number(txParams[LAST_ROUND]) + 1000,
      flatFee: false
    };

    s.flatFee = userParams.totalFee !== undefined;
    s.fee = userParams.totalFee ?? userParams.feePerByte ?? txParams["min-fee"];
    if (s.flatFee) s.fee = Math.max(s.fee, txParams["min-fee"]);

    s.firstRound = userParams.firstValid ?? s.firstRound;
    s.lastRound = userParams.firstValid === undefined || userParams.validRounds === undefined
      ? s.lastRound : Number(userParams.firstValid) + Number(userParams.validRounds);

    return s;
  }
}
