import type { LogicSigArgs } from "algosdk";
import algosdk from "algosdk";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { txWriter } from "../internal/tx-log-writer";
import { createClient } from "../lib/driver";
import { getLsig } from "../lib/lsig";
import type {
  Account,
  AccountMap,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  ASCCache,
  FundASCFlags,
  LsigInfo,
  Network,
  SSCDeploymentFlags,
  SSCInfo,
  StrMap,
  TxParams
} from "../types";
import { CompileOp } from "./compile";
import * as tx from "./tx";
const confirmedRound = "confirmed-round";

// This was not exported in algosdk
export const ALGORAND_MIN_TX_FEE = 1000;
// Extracted from interaction with Algorand node (100k microAlgos)
const ALGORAND_ASA_OWNERSHIP_COST = 100000;

export function createAlgoOperator (network: Network): AlgoOperator {
  return new AlgoOperatorImpl(createClient(network));
}

export interface AlgoOperator {
  algodClient: algosdk.Algodv2
  deployASA: (
    name: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: AccountMap, txWriter: txWriter
  ) => Promise<ASAInfo>
  fundLsig: (name: string, flags: FundASCFlags, payFlags: TxParams,
    txWriter: txWriter, scParams: LogicSigArgs, scTmplParams?: StrMap) => Promise<LsigInfo>
  deploySSC: (
    approvalProgram: string,
    clearProgram: string,
    flags: SSCDeploymentFlags,
    payFlags: TxParams,
    txWriter: txWriter,
    scTmplParams?: StrMap) => Promise<SSCInfo>
  waitForConfirmation: (txId: string) => Promise<algosdk.ConfirmedTxInfo>
  optInToASA: (
    asaName: string, assetIndex: number, account: Account, params: TxParams
  ) => Promise<void>
  optInToASAMultiple: (
    asaName: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: AccountMap, assetIndex: number
  ) => Promise<void>
  optInToSSC: (
    sender: Account, appId: number, payFlags: TxParams, appArgs?: Uint8Array[]) => Promise<void>
  ensureCompiled: (name: string, force?: boolean, scTmplParams?: StrMap) => Promise<ASCCache>
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

  getTxFee (params: algosdk.SuggestedParams, txSize: number): number {
    if (params.flatFee) {
      return Math.max(ALGORAND_MIN_TX_FEE, params.fee);
    }
    return Math.max(ALGORAND_MIN_TX_FEE, txSize);
  }

  getUsableAccBalance (accoutInfo: algosdk.AccountState): number {
    // Extracted from interacting with Algorand node:
    // 7 opted-in assets require to have 800000 micro algos (frozen in account).
    // 11 assets require 1200000.
    return accoutInfo.amount - (accoutInfo.assets.length + 1) * ALGORAND_ASA_OWNERSHIP_COST;
  }

  getOptInTxSize (params: algosdk.SuggestedParams, accounts: AccountMap): number {
    const randomAccount = accounts.values().next().value;
    // assetID can't be known before ASA creation
    // it shouldn't be easy to find out the latest asset ID
    // In original source code it's uint64:
    // https://github.com/algorand/go-algorand/blob/1424855ad2b5f6755ff3feba7e419ee06f2493da/data/basics/userBalance.go#L278
    const assetID = Number.MAX_SAFE_INTEGER; // not 64 bits but 55 bits should be enough
    const sampleASAOptInTX = tx.makeASAOptInTx(randomAccount.addr, assetID, params);
    const rawSignedTxn = sampleASAOptInTX.signTxn(randomAccount.sk);
    return rawSignedTxn.length;
  }

  async _optInToASA (
    asaName: string, assetIndex: number, account: Account, params: algosdk.SuggestedParams
  ): Promise<void> {
    console.log(`ASA ${account.name} opt-in for ASA ${asaName}`);
    const sampleASAOptInTX = tx.makeASAOptInTx(account.addr, assetIndex, params);
    const rawSignedTxn = sampleASAOptInTX.signTxn(account.sk);
    const txInfo = await this.algodClient.sendRawTransaction(rawSignedTxn).do();
    await this.waitForConfirmation(txInfo.txId);
  }

  async optInToASA (
    asaName: string, assetIndex: number, account: Account, flags: TxParams
  ): Promise<void> {
    const txParams = await tx.mkTxParams(this.algodClient, flags);
    await this._optInToASA(asaName, assetIndex, account, txParams);
  }

  async optInToASAMultiple (
    asaName: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: AccountMap, assetIndex: number
  ): Promise<void> {
    const txParams = await tx.mkTxParams(this.algodClient, flags);
    const optInAccounts = await this.checkBalanceForOptInTx(
      asaName,
      txParams,
      asaDef,
      accounts,
      flags.creator);
    for (const account of optInAccounts) {
      await this._optInToASA(asaName, assetIndex, account, txParams);
    }
  }

  async checkBalanceForOptInTx (
    name: string, params: algosdk.SuggestedParams, asaDef: ASADef, accounts: AccountMap, creator: Account
  ): Promise<Account[]> {
    if (!asaDef.optInAccNames || asaDef.optInAccNames.length === 0) {
      return [];
    }
    const optInTxFee = this.getTxFee(params, this.getOptInTxSize(params, accounts));
    const optInAccs = [];
    for (const accName of asaDef.optInAccNames) {
      const account = accounts.get(accName);
      if (!account) {
        throw new BuilderError(
          ERRORS.SCRIPT.ASA_OPT_IN_ACCOUNT_NOT_FOUND, {
            accountName: accName
          });
      }
      optInAccs.push(account);
      if (account.addr === creator.addr) {
        throw new BuilderError(ERRORS.SCRIPT.ASA_TRIED_TO_OPT_IN_CREATOR);
      }
      const accountInfo = await this.algodClient.accountInformation(account.addr).do();
      const requiredAmount = optInTxFee + ALGORAND_ASA_OWNERSHIP_COST;
      const usableAmount = this.getUsableAccBalance(accountInfo);
      if (usableAmount < requiredAmount) {
        throw new BuilderError(
          ERRORS.SCRIPT.ASA_OPT_IN_ACCOUNT_INSUFFICIENT_BALANCE, {
            accountName: accName,
            balance: usableAmount,
            requiredBalance: requiredAmount,
            asaName: name
          });
      }
    }
    return optInAccs;
  }

  async deployASA (
    name: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: AccountMap,
    txWriter: txWriter): Promise<ASAInfo> {
    const message = 'Deploying ASA: ' + name;
    console.log(message);
    const txParams = await tx.mkTxParams(this.algodClient, flags);
    const assetTX = tx.makeAssetCreateTxn(name, asaDef, flags, txParams);
    const rawSignedTxn = assetTX.signTxn(flags.creator.sk);
    const txInfo = await this.algodClient.sendRawTransaction(rawSignedTxn).do();
    const txConfirmation = await this.waitForConfirmation(txInfo.txId);
    const assetIndex = txConfirmation["asset-index"];

    txWriter.push(message, txConfirmation);
    return {
      creator: flags.creator.addr,
      txId: txInfo.txId,
      assetIndex: assetIndex,
      confirmedRound: txConfirmation[confirmedRound]
    };
  }

  /**
   * Sends Algos to ASC account (Contract Account)
   * @param name     - ASC filename
   * @param flags    - FundASC flags (as per SPEC)
   * @param payFlags - as per SPEC
   * @param txWriter - transaction log writer
   * @param scParams: Smart contract Parameters(Used while calling smart contract)
   * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
   */
  async fundLsig (
    name: string,
    flags: FundASCFlags,
    payFlags: TxParams,
    txWriter: txWriter,
    scParams: LogicSigArgs,
    scTmplParams?: StrMap): Promise<LsigInfo> {
    const lsig = await getLsig(name, this.algodClient, scParams, scTmplParams);
    const contractAddress = lsig.address();

    const params = await tx.mkTxParams(this.algodClient, payFlags);
    let message = "Funding Contract: " + contractAddress;
    console.log(message);

    const closeToRemainder = undefined;
    const note = tx.encodeNote(payFlags.note, payFlags.noteb64);
    const t = algosdk.makePaymentTxnWithSuggestedParams(flags.funder.addr, contractAddress,
      flags.fundingMicroAlgo, closeToRemainder,
      note,
      params);
    const signedTxn = t.signTxn(flags.funder.sk);
    const txInfo = await this.algodClient.sendRawTransaction(signedTxn).do();
    const confirmedTxn = await this.waitForConfirmation(txInfo.txId);
    message = message.concat("\nLsig: " + name);
    txWriter.push(message, confirmedTxn);
    return {
      creator: flags.funder.addr,
      contractAddress: contractAddress,
      lsig: lsig
    };
  }

  /**
   * Function to deploy Stateful Smart Contract
   * @param approvalProgram name of file in which approval program is stored
   * @param clearProgram name of file in which clear program is stored
   * @param flags         SSCDeploymentFlags
   * @param payFlags      TxParams
   * @param txWriter
   * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
   */
  async deploySSC (
    approvalProgram: string,
    clearProgram: string,
    flags: SSCDeploymentFlags,
    payFlags: TxParams,
    txWriter: txWriter,
    scTmplParams?: StrMap): Promise<SSCInfo> {
    const sender = flags.sender.addr;
    const params = await tx.mkTxParams(this.algodClient, payFlags);

    const onComplete = algosdk.OnApplicationComplete.NoOpOC;

    const app = await this.ensureCompiled(approvalProgram, false, scTmplParams);
    const approvalProg = new Uint8Array(Buffer.from(app.compiled, "base64"));
    const clear = await this.ensureCompiled(clearProgram, false, scTmplParams);
    const clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));

    const txn = algosdk.makeApplicationCreateTxn(
      sender,
      params,
      onComplete,
      approvalProg,
      clearProg,
      flags.localInts,
      flags.localBytes,
      flags.globalInts,
      flags.globalBytes,
      flags.appArgs,
      flags.accounts,
      flags.foreignApps,
      flags.foreignAssets,
      flags.note,
      flags.lease,
      flags.rekeyTo);

    const txId = txn.txID().toString();
    const signedTxn = txn.signTxn(flags.sender.sk);

    const txInfo = await this.algodClient.sendRawTransaction(signedTxn).do();
    const confirmedTxInfo = await this.waitForConfirmation(txId);

    const appId = confirmedTxInfo['application-index'];
    const message = `Signed transaction with txID: ${txId}\nCreated new app-id: ${appId}`; // eslint-disable-line @typescript-eslint/restrict-template-expressions

    console.log(message);
    txWriter.push(message, confirmedTxInfo);

    return {
      creator: flags.sender.addr,
      txId: txInfo.txId,
      confirmedRound: confirmedTxInfo[confirmedRound],
      appID: appId
    };
  }

  /**
   * Opt-In to stateful smart contract
   * @param sender: Account for which opt-in is required
   * @param appId: Application Index: (ID of the application)
   * @param payFlags: Transaction Params
   */
  async optInToSSC (
    sender: Account,
    appId: number,
    payFlags: TxParams,
    appArgs?: Uint8Array[]): Promise<void> {
    const params = await tx.mkTxParams(this.algodClient, payFlags);
    const txn = algosdk.makeApplicationOptInTxn(sender.addr, params, appId, appArgs);
    const txId = txn.txID().toString();
    const signedTxn = txn.signTxn(sender.sk);

    await this.algodClient.sendRawTransaction(signedTxn).do();
    await this.waitForConfirmation(txId);
  }

  async ensureCompiled (name: string, force?: boolean, scTmplParams?: StrMap): Promise<ASCCache> {
    return await this.compileOp.ensureCompiled(name, force, scTmplParams);
  }
}
