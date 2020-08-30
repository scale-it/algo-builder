import algosdk from "algosdk";

import { createClient } from "../lib/driver";
import {
  Account,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  ASCCache,
  ASCDeploymentFlags,
  ASCInfo,
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
  deployASC: (programb64: string, scParams: object, flags: ASCDeploymentFlags,
    account: Account) => Promise<ASCInfo>
  waitForConfirmation: (txId: string) => Promise<algosdk.ConfirmedTxInfo>
  ensuredCompiled: (name: string, force: boolean) => Promise<ASCCache>
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
    console.log("Deploying ASA:", name);
    const assetTX = await tx.makeAssetCreateTxn(name, this.algodClient, asaDesc, flags);
    const rawSignedTxn = assetTX.signTxn(flags.creator.sk);
    const txInfo = await this.algodClient.sendRawTransaction(rawSignedTxn).do();
    const txConfirmation = await this.waitForConfirmation(txInfo.txId);
    return {
      creator: flags.creator.addr,
      txId: txInfo.txId,
      assetIndex: txConfirmation["asset-index"],
      confirmedRound: txConfirmation[confirmedRound]
    };
  }

  async deployASC (programb64: string, scParams: object, flags: ASCDeploymentFlags
  ): Promise<ASCInfo> {
    const program = new Uint8Array(Buffer.from(programb64, "base64"));

    const lsig = algosdk.makeLogicSig(program, scParams);

    const params = await this.algodClient.getTransactionParams().do();

    console.log(params);

    // ASC1 signed by funder
    // lsig.sign(flags.funder.sk);
    const funder = flags.creator.addr;
    const contractAddress = lsig.address();
    // const receiver = funder;

    // Fund smart contract
    console.log("Funding Contract:", contractAddress);
    console.log(funder);
    const tran = algosdk.makePaymentTxnWithSuggestedParams(funder, contractAddress,
      flags.microAlgo, flags.closeToRemainder, flags.note, params);

    const signedTxn = tran.signTxn(flags.creator.sk);

    const tranInfo = await this.algodClient.sendRawTransaction(signedTxn).do();

    const confirmedTxn = await this.algodClient.pendingTransactionInformation(tranInfo.txId).do();
    console.log("Transaction information: %o", confirmedTxn);

    const amount = 100;

    // Transaction made from smart contract account
    const txn = algosdk.makePaymentTxnWithSuggestedParams(contractAddress, funder,
      amount, flags.closeToRemainder, flags.note, params);

    const rawSignedTxn = algosdk.signLogicSigTransactionObject(txn, lsig);
    const txInfo = (await this.algodClient.sendRawTransaction(rawSignedTxn.blob).do());
    const txConfirmation = await this.waitForConfirmation(txInfo.txId);
    console.log(txConfirmation);
    return {
      creator: flags.creator.addr,
      contractAddress: contractAddress,
      txId: txInfo.txId,
      logicSignature: lsig,
      confirmedRound: txConfirmation[confirmedRound]
    };
  }

  async ensuredCompiled (name: string, force: boolean): Promise<ASCCache> {
    return await this.compileOp.ensureCompiled(name, false);
  }
}
