import algosdk from "algosdk";

import { createClient } from "../lib/driver";
import {
  Account,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  Network
} from "../types";
import * as tx from "./tx";

const confirmedRound = "confirmed-round";

export function createDeployClient (network: Network): AlgoDeployClient {
  return new AlgoClientImpl(createClient(network));
}

export interface AlgoDeployClient {
  deployASA: (name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account) => Promise<ASAInfo>
}

export class AlgoClientImpl implements AlgoDeployClient {
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
    name: string, asaDesc: ASADef, flags: ASADeploymentFlags
  ): Promise<ASAInfo> {
    console.log("Deploying ASA:", name);
    const assetTX = await tx.makeAssetCreateTxn(name, this.algoClient, asaDesc, flags);
    const rawSignedTxn = assetTX.signTxn(flags.creator.sk);
    const txInfo = await this.algoClient.sendRawTransaction(rawSignedTxn).do();
    const txConfirmation = await this.waitForConfirmation(txInfo.txId);
    return {
      creator: flags.creator.addr,
      txId: txInfo.txId,
      assetIndex: txConfirmation["asset-index"],
      confirmedRound: txConfirmation[confirmedRound]
    };
  }
}
