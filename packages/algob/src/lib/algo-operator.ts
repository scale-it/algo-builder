import { encodeNote, mkTransaction, types as rtypes } from "@algo-builder/runtime";
import algosdk, { LogicSig } from "algosdk";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { txWriter } from "../internal/tx-log-writer";
import { createClient } from "../lib/driver";
import { getLsig } from "../lib/lsig";
import type {
  ASAInfo,
  ASCCache,
  FundASCFlags,
  LsigInfo,
  Network,
  SCParams,
  SSCInfo
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
    name: string, asaDef: rtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap, txWriter: txWriter
  ) => Promise<ASAInfo>
  fundLsig: (name: string, flags: FundASCFlags, payFlags: rtypes.TxParams,
    txWriter: txWriter, scTmplParams?: SCParams) => Promise<LsigInfo>
  deploySSC: (
    approvalProgram: string,
    clearProgram: string,
    flags: rtypes.SSCDeploymentFlags,
    payFlags: rtypes.TxParams,
    txWriter: txWriter,
    scTmplParams?: SCParams) => Promise<SSCInfo>
  updateSSC: (
    sender: algosdk.Account,
    payFlags: rtypes.TxParams,
    appId: number,
    newApprovalProgram: string,
    newClearProgram: string,
    flags: rtypes.SSCOptionalFlags,
    txWriter: txWriter
  ) => Promise<SSCInfo>
  waitForConfirmation: (txId: string) => Promise<algosdk.ConfirmedTxInfo>
  getAssetByID: (assetIndex: number | bigint) => Promise<algosdk.AssetInfo>
  optInAcountToASA: (
    asaName: string, assetIndex: number, account: rtypes.Account, params: rtypes.TxParams
  ) => Promise<void>
  optInLsigToASA: (
    asaName: string, assetIndex: number, lsig: algosdk.LogicSig, params: rtypes.TxParams
  ) => Promise<void>
  optInToASAMultiple: (
    asaName: string, asaDef: rtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap, assetIndex: number
  ) => Promise<void>
  optInAccountToSSC: (
    sender: rtypes.Account, appId: number,
    payFlags: rtypes.TxParams, flags: rtypes.SSCOptionalFlags) => Promise<void>
  optInLsigToSSC: (
    appId: number, lsig: LogicSig,
    payFlags: rtypes.TxParams, flags: rtypes.SSCOptionalFlags) => Promise<void>
  ensureCompiled: (name: string, force?: boolean, scTmplParams?: SCParams) => Promise<ASCCache>
  sendAndWait: (rawTxns: Uint8Array | Uint8Array[]) => Promise<algosdk.ConfirmedTxInfo>
}

export class AlgoOperatorImpl implements AlgoOperator {
  algodClient: algosdk.Algodv2;
  compileOp: CompileOp;
  constructor (algocl: algosdk.Algodv2) {
    this.algodClient = algocl;
    this.compileOp = new CompileOp(this.algodClient);
  }

  /**
   * Send signed transaction to network and wait for confirmation
   * @param rawTxns Signed Transaction(s)
   */
  async sendAndWait (rawTxns: Uint8Array | Uint8Array[]): Promise<algosdk.ConfirmedTxInfo> {
    const txInfo = await this.algodClient.sendRawTransaction(rawTxns).do();
    return await this.waitForConfirmation(txInfo.txId);
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

  /**
   * Queries blockchain using algodClient for asset information by index */
  async getAssetByID (assetIndex: number | bigint): Promise<algosdk.AssetInfo> {
    return await this.algodClient.getAssetByID(assetIndex).do();
  }

  getTxFee (params: algosdk.SuggestedParams, txSize: number): number {
    if (params.flatFee) {
      return Math.max(ALGORAND_MIN_TX_FEE, params.fee);
    }
    return Math.max(ALGORAND_MIN_TX_FEE, txSize);
  }

  getUsableAccBalance (accoutInfo: algosdk.AccountState): bigint {
    // Extracted from interacting with Algorand node:
    // 7 opted-in assets require to have 800000 micro algos (frozen in account).
    // 11 assets require 1200000.
    return BigInt(accoutInfo.amount) - BigInt((accoutInfo.assets.length + 1) * ALGORAND_ASA_OWNERSHIP_COST);
  }

  getOptInTxSize (
    params: algosdk.SuggestedParams, accounts: rtypes.AccountMap,
    flags: rtypes.TxParams
  ): number {
    const randomAccount = accounts.values().next().value;
    // assetID can't be known before ASA creation
    // it shouldn't be easy to find out the latest asset ID
    // In original source code it's uint64:
    // https://github.com/algorand/go-algorand/blob/1424855ad2b5f6755ff3feba7e419ee06f2493da/data/basics/userBalance.go#L278
    const assetID = Number.MAX_SAFE_INTEGER; // not 64 bits but 55 bits should be enough
    const sampleASAOptInTX = tx.makeASAOptInTx(randomAccount.addr, assetID, params, flags);
    const rawSignedTxn = sampleASAOptInTX.signTxn(randomAccount.sk);
    return rawSignedTxn.length;
  }

  async _optInAcountToASA (
    asaName: string, assetIndex: number,
    account: rtypes.Account, params: algosdk.SuggestedParams,
    flags: rtypes.TxParams
  ): Promise<void> {
    console.log(`ASA ${account.name} opt-in for ASA ${asaName}`);
    const sampleASAOptInTX = tx.makeASAOptInTx(account.addr, assetIndex, params, flags);
    const rawSignedTxn = sampleASAOptInTX.signTxn(account.sk);
    await this.sendAndWait(rawSignedTxn);
  }

  async optInAcountToASA (
    asaName: string, assetIndex: number, account: rtypes.Account, flags: rtypes.TxParams
  ): Promise<void> {
    const txParams = await tx.mkTxParams(this.algodClient, flags);
    await this._optInAcountToASA(asaName, assetIndex, account, txParams, flags);
  }

  async optInLsigToASA (
    asaName: string, assetIndex: number, lsig: algosdk.LogicSig, flags: rtypes.TxParams
  ): Promise<void> {
    console.log(`Contract ${lsig.address()} opt-in for ASA ${asaName}`);
    const txParams = await tx.mkTxParams(this.algodClient, flags);

    const optInLsigToASATx = tx.makeASAOptInTx(lsig.address(), assetIndex, txParams, flags);
    const rawLsigSignedTx = algosdk.signLogicSigTransactionObject(optInLsigToASATx, lsig).blob;
    const txInfo = await this.algodClient.sendRawTransaction(rawLsigSignedTx).do();
    await this.waitForConfirmation(txInfo.txId);
  }

  async optInToASAMultiple (
    asaName: string, asaDef: rtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap, assetIndex: number
  ): Promise<void> {
    const txParams = await tx.mkTxParams(this.algodClient, flags);
    const optInAccounts = await this.checkBalanceForOptInTx(
      asaName,
      txParams,
      asaDef,
      accounts,
      flags.creator,
      flags);
    for (const account of optInAccounts) {
      await this._optInAcountToASA(asaName, assetIndex, account, txParams, flags);
    }
  }

  async checkBalanceForOptInTx (
    name: string, params: algosdk.SuggestedParams,
    asaDef: rtypes.ASADef, accounts: rtypes.AccountMap,
    creator: rtypes.Account, flags: rtypes.TxParams
  ): Promise<rtypes.Account[]> {
    if (!asaDef.optInAccNames || asaDef.optInAccNames.length === 0) {
      return [];
    }
    const optInTxFee = this.getTxFee(params, this.getOptInTxSize(params, accounts, flags));
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
    name: string, asaDef: rtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap,
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
      confirmedRound: txConfirmation[confirmedRound],
      assetDef: asaDef
    };
  }

  /**
   * Sends Algos to ASC account (Contract Account)
   * @param name     - ASC filename
   * @param flags    - FundASC flags (as per SPEC)
   * @param payFlags - as per SPEC
   * @param txWriter - transaction log writer
   * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
   */
  async fundLsig (
    name: string,
    flags: FundASCFlags,
    payFlags: rtypes.TxParams,
    txWriter: txWriter,
    scTmplParams?: SCParams): Promise<LsigInfo> {
    const lsig = await getLsig(name, this.algodClient, scTmplParams);
    const contractAddress = lsig.address();

    const params = await tx.mkTxParams(this.algodClient, payFlags);
    let message = "Funding Contract: " + contractAddress;
    console.log(message);

    const closeToRemainder = undefined;
    const note = encodeNote(payFlags.note, payFlags.noteb64);
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
    flags: rtypes.SSCDeploymentFlags,
    payFlags: rtypes.TxParams,
    txWriter: txWriter,
    scTmplParams?: SCParams): Promise<SSCInfo> {
    const sender = flags.sender.addr;
    const params = await tx.mkTxParams(this.algodClient, payFlags);

    const onComplete = algosdk.OnApplicationComplete.NoOpOC;

    const app = await this.ensureCompiled(approvalProgram, false, scTmplParams);
    const approvalProg = new Uint8Array(Buffer.from(app.compiled, "base64"));
    const clear = await this.ensureCompiled(clearProgram, false, scTmplParams);
    const clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));

    const execParam: rtypes.ExecParams = {
      type: rtypes.TransactionType.DeploySSC,
      sign: rtypes.SignType.SecretKey,
      fromAccount: flags.sender,
      approvalProgram: approvalProgram,
      clearProgram: clearProgram,
      approvalProg: approvalProg,
      clearProg: clearProg,
      payFlags: payFlags,
      localInts: flags.localInts,
      localBytes: flags.localBytes,
      globalInts: flags.globalInts,
      globalBytes: flags.globalBytes,
      accounts: flags.accounts,
      foreignApps: flags.foreignApps,
      foreignAssets: flags.foreignAssets,
      appArgs: flags.appArgs,
      note: flags.note,
      lease: flags.lease
    };

    const txn = mkTransaction(execParam, params);
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
      appID: appId,
      timestamp: Math.round(+new Date() / 1000)
    };
  }

  /**
   * Update programs (approval, clear) for a stateful smart contract.
   * @param sender Account from which call needs to be made
   * @param payFlags Transaction Flags
   * @param appId index of the application being configured
   * @param newApprovalProgram New Approval Program filename
   * @param newClearProgram New Clear Program filename
   * @param flags Optional parameters to SSC (accounts, args..)
   */
  async updateSSC (
    sender: algosdk.Account,
    payFlags: rtypes.TxParams,
    appID: number,
    newApprovalProgram: string,
    newClearProgram: string,
    flags: rtypes.SSCOptionalFlags,
    txWriter: txWriter
  ): Promise<SSCInfo> {
    const params = await tx.mkTxParams(this.algodClient, payFlags);

    const app = await this.ensureCompiled(newApprovalProgram, false);
    const approvalProg = new Uint8Array(Buffer.from(app.compiled, "base64"));
    const clear = await this.ensureCompiled(newClearProgram, false);
    const clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));

    const execParam: rtypes.ExecParams = {
      type: rtypes.TransactionType.UpdateSSC,
      sign: rtypes.SignType.SecretKey,
      fromAccount: sender,
      appID: appID,
      newApprovalProgram: newApprovalProgram,
      newClearProgram: newClearProgram,
      approvalProg: approvalProg,
      clearProg: clearProg,
      payFlags: payFlags,
      accounts: flags.accounts,
      foreignApps: flags.foreignApps,
      foreignAssets: flags.foreignAssets,
      appArgs: flags.appArgs,
      note: flags.note,
      lease: flags.lease
    };

    const txn = mkTransaction(execParam, params);
    const txId = txn.txID().toString();
    const signedTxn = txn.signTxn(sender.sk);

    const txInfo = await this.algodClient.sendRawTransaction(signedTxn).do();
    const confirmedTxInfo = await this.waitForConfirmation(txId);

    const appId = appID;
    const message = `Signed transaction with txID: ${txId}\nUpdated app-id: ${appId}`; // eslint-disable-line @typescript-eslint/restrict-template-expressions

    console.log(message);
    txWriter.push(message, confirmedTxInfo);

    return {
      creator: sender.addr,
      txId: txInfo.txId,
      confirmedRound: confirmedTxInfo[confirmedRound],
      appID: appId,
      timestamp: Math.round(+new Date() / 1000)
    };
  }

  /**
   * Opt-In to stateful smart contract
   *  - signed by account's secret key
   * @param sender: Account for which opt-in is required
   * @param appId: Application Index: (ID of the application)
   * @param payFlags: Transaction Params
   * @param flags Optional parameters to SSC (accounts, args..)
   */
  async optInAccountToSSC (
    sender: rtypes.Account,
    appID: number,
    payFlags: rtypes.TxParams,
    flags: rtypes.SSCOptionalFlags): Promise<void> {
    const params = await tx.mkTxParams(this.algodClient, payFlags);
    const execParam: rtypes.ExecParams = {
      type: rtypes.TransactionType.OptInSSC,
      sign: rtypes.SignType.SecretKey,
      fromAccount: sender,
      appID: appID,
      payFlags: payFlags,
      appArgs: flags.appArgs,
      accounts: flags.accounts,
      foreignApps: flags.foreignApps,
      foreignAssets: flags.foreignAssets
    };

    const txn = mkTransaction(execParam, params);
    const txId = txn.txID().toString();
    const signedTxn = txn.signTxn(sender.sk);

    await this.sendAndWait(signedTxn);
  }

  /**
   * Opt-In to stateful smart contract (SSC) for a contract account
   * The opt-in transaction is signed by the logic signature
   * @param appID application index
   * @param lsig logic signature
   * @param payFlags Transaction flags
   * @param flags Optional parameters to SSC (accounts, args..)
   */
  async optInLsigToSSC (
    appID: number, lsig: LogicSig,
    payFlags: rtypes.TxParams,
    flags: rtypes.SSCOptionalFlags
  ): Promise<void> {
    console.log(`Contract ${lsig.address()} opt-in for SSC ID ${appID}`);
    const params = await tx.mkTxParams(this.algodClient, payFlags);
    const execParam: rtypes.ExecParams = {
      type: rtypes.TransactionType.OptInSSC,
      sign: rtypes.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      lsig: lsig,
      appID: appID,
      payFlags: payFlags,
      appArgs: flags.appArgs,
      accounts: flags.accounts,
      foreignApps: flags.foreignApps,
      foreignAssets: flags.foreignAssets
    };
    const optInLsigToSSCTx = mkTransaction(execParam, params);

    const rawLsigSignedTx = algosdk.signLogicSigTransactionObject(optInLsigToSSCTx, lsig).blob;
    await this.sendAndWait(rawLsigSignedTx);
  }

  async ensureCompiled (name: string, force?: boolean, scTmplParams?: SCParams): Promise<ASCCache> {
    return await this.compileOp.ensureCompiled(name, force, scTmplParams);
  }
}
