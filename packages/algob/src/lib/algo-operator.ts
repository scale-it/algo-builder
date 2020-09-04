import algosdk from "algosdk";
import { TextEncoder } from "util";

import { createClient } from "../lib/driver";
import {
  Account,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  ASCCache,
  ASCDeploymentFlags,
  ASCInfo,
  ASCPaymentFlags,
  Network
} from "../types";
import { CompileOp } from "./compile";
import * as tx from "./tx";

const confirmedRound = "confirmed-round";

export function createAlgoOperator (network: Network): AlgoOperator {
  return new AlgoOperatorImpl(createClient(network));
}

export interface AlgoOperator {
  algodClient: algosdk.Algodv2
  deployASA: (name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account) => Promise<ASAInfo>
  deployASC: (programb64: string, scParams: object, flags: ASCDeploymentFlags, payFlags: ASCPaymentFlags,
  ) => Promise<ASCInfo>
  waitForConfirmation: (txId: string) => Promise<algosdk.ConfirmedTxInfo>
}

export class AlgoOperatorImpl implements AlgoOperator {
  algodClient: algosdk.Algodv2;
  compileOp: CompileOp;
  constructor (algocl: algosdk.Algodv2) {
    this.algodClient = algocl;
    this.compileOp = new CompileOp(this.algodClient);
  }

  // Source:
  // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L21
  // Function used to wait for a tx confirmation
  async waitForConfirmation (txId: string): Promise<algosdk.ConfirmedTxInfo> {
    const response = await this.algodClient.status().do();
    let lastround = response["last-round"];
    while (true) {
      const pendingInfo = await this.algodClient.pendingTransactionInformation(txId).do();
      if (pendingInfo[confirmedRound] !== null && pendingInfo[confirmedRound] > 0) {
        return pendingInfo;
      }
      lastround++;
      await this.algodClient.statusAfterBlock(lastround).do();
    }
  };

  async deployASA (
    name: string, asaDesc: ASADef, flags: ASADeploymentFlags
  ): Promise<ASAInfo> {
    console.log("Deploying ASA: ", name);

    const assetTX = await tx.makeAssetCreateTxn(name, this.algodClient, asaDesc, flags);
    const rawSignedTxn = assetTX.signTxn(flags.creator.sk);
    const txInfo = await this.algodClient.sendRawTransaction(rawSignedTxn).do();
    const txConfirmation = await this.waitForConfirmation(txInfo.txId);
    console.log(txConfirmation);
    return {
      creator: flags.creator.addr,
      txId: txInfo.txId,
      assetIndex: txConfirmation["asset-index"],
      confirmedRound: txConfirmation[confirmedRound]
    };
  }

  async deployASC (name: string, scParams: object, flags: ASCDeploymentFlags, payFlags: ASCPaymentFlags
  ): Promise<ASCInfo> {
    console.log("Deploying ASC: ", name);

    const result: ASCCache = await this.ensureCompiled(name, false);
    const programb64 = result.compiled;
    const program = new Uint8Array(Buffer.from(programb64, "base64"));
    const lsig = algosdk.makeLogicSig(program, scParams);

    const params = await tx.getSuggestedParamsWithUserDefaults(this.algodClient, payFlags);

    // ASC1 signed by funder
    lsig.sign(flags.funder.sk);
    const funder = flags.funder.addr;
    const contractAddress = lsig.address();

    // Fund smart contract
    console.log("Funding Contract:", contractAddress);
    const encoder = new TextEncoder();
    const tran = algosdk.makePaymentTxnWithSuggestedParams(funder, contractAddress,
      flags.fundingMicroAlgo, payFlags.closeToRemainder,
      payFlags.note ? encoder.encode(payFlags.note) : undefined,
      params);

    const signedTxn = tran.signTxn(flags.funder.sk);

    const tranInfo = await this.algodClient.sendRawTransaction(signedTxn).do();

    const confirmedTxn = await this.waitForConfirmation(tranInfo.txId);

    console.log(confirmedTxn);

    return {
      creator: flags.funder.addr,
      contractAddress: contractAddress,
      txId: tranInfo.txId,
      logicSignature: lsig,
      confirmedRound: confirmedTxn[confirmedRound]
    };
  }

  private async ensureCompiled (name: string, force: boolean): Promise<ASCCache> {
    return await this.compileOp.ensureCompiled(name, force);
  }
}
