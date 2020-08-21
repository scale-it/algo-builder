import algosdk from "algosdk";

import {
  Account,
  ASADef,
  ASADeploymentFlags,
  ASAInfo
} from "../types";
import * as t from "./tx";

const confirmedRound = "confirmed-round";

export interface AlgoSDKWrapper {
  deployASA: (name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account) => Promise<ASAInfo>
}

export class AlgoSDKWrapperDryRunImpl implements AlgoSDKWrapper {
  async deployASA (
    name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account
  ): Promise<ASAInfo> {
    return {
      creator: account.addr + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      assetIndex: -1,
      confirmedRound: -1
    };
  }
}

export class AlgoSDKWrapperImpl implements AlgoSDKWrapper {
  private readonly algoClient: algosdk.Algodv2;

  constructor (algoClient: algosdk.Algodv2) {
    this.algoClient = algoClient;
  }

  // Source:
  // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L21
  // Function used to wait for a tx confirmation
  async waitForConfirmation (txId: string): Promise<algosdk.PendingTransactionInformation> {
    const response = await this.algoClient.status().do();
    let lastround = response["last-round"];
    while (true) {
      const pendingInfo = await this.algoClient.pendingTransactionInformation(txId).do();
      if (pendingInfo[confirmedRound] !== null && pendingInfo[confirmedRound] > 0) {
        return pendingInfo;
      }
      lastround++;
      await this.algoClient.statusAfterBlock(lastround).do();
    }
  };

  async deployASA (
    name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account
  ): Promise<ASAInfo> {
    const tx = await t.makeAssetCreateTxn(this.algoClient, asaDesc, flags, account);
    const rawSignedTxn = tx.signTxn(account.sk);
    const txInfo = await this.algoClient.sendRawTransaction(rawSignedTxn).do();
    const txConfirmation = await this.waitForConfirmation(txInfo.txId);
    return {
      creator: account.addr,
      txId: txInfo.txId,
      assetIndex: txConfirmation["asset-index"],
      confirmedRound: txConfirmation[confirmedRound]
    };
  }
}
