import { encode } from "@msgpack/msgpack";
import algosdk from "algosdk";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { txWriter } from "../internal/tx-log-writer";
import { createClient } from "../lib/driver";
import { getLsig } from "../lib/lsig";
import {
  Account,
  Accounts,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  ASCCache,
  FundASCFlags,
  LsigInfo,
  Network,
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
    name: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: Accounts, txWriter: txWriter
  ) => Promise<ASAInfo>
  fundLsig: (name: string, scParams: object, flags: FundASCFlags, payFlags: TxParams,
    txWriter: txWriter) => Promise<LsigInfo>
  waitForConfirmation: (txId: string) => Promise<algosdk.ConfirmedTxInfo>
  optInToASA: (
    asaName: string, assetIndex: number, account: Account, params: TxParams
  ) => Promise<void>
  optInToASAMultiple: (
    asaName: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: Accounts, assetIndex: number
  ) => Promise<void>
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

  getUsableAccBalance (accoutInfo: algosdk.AccountInfo): number {
    // Extracted from interacting with Algorand node:
    // 7 opted-in assets require to have 800000 micro algos (frozen in account).
    // 11 assets require 1200000.
    return accoutInfo.amount - (accoutInfo.assets.length + 1) * ALGORAND_ASA_OWNERSHIP_COST;
  }

  getOptInTxSize (params: algosdk.SuggestedParams, accounts: Accounts): number {
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
    const txParams = await tx.mkSuggestedParams(this.algodClient, flags);
    await this._optInToASA(asaName, assetIndex, account, txParams);
  }

  async optInToASAMultiple (
    asaName: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: Accounts, assetIndex: number
  ): Promise<void> {
    const txParams = await tx.mkSuggestedParams(this.algodClient, flags);
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
    name: string, params: algosdk.SuggestedParams, asaDef: ASADef, accounts: Accounts, creator: Account
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
    name: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: Accounts,
    txWriter: txWriter): Promise<ASAInfo> {
    const message = 'Deploying ASA: ' + name;
    console.log(message);
    const txParams = await tx.mkSuggestedParams(this.algodClient, flags);
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
   * Description - This function will send Algos to ASC account in "Contract Mode"
   * @param name     - ASC filename
   * @param scParams - SC parameters
   * @param flags    - FundASC flags (as per SPEC)
   * @param payFlags - as per SPEC
   * @param txWriter - transaction log writer
   */
  async fundLsig (
    name: string,
    scParams: Object,
    flags: FundASCFlags,
    payFlags: TxParams,
    txWriter: txWriter): Promise<LsigInfo> {
    const lsig = await getLsig(name, scParams, this.algodClient);
    const contractAddress = lsig.address();

    const params = await tx.mkSuggestedParams(this.algodClient, payFlags);
    let message = "Funding Contract: ";
    message = message.concat(contractAddress);
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
      lsig: encode(lsig)
    };
  }

  private async ensureCompiled (name: string, force: boolean): Promise<ASCCache> {
    return await this.compileOp.ensureCompiled(name, force);
  }
}
