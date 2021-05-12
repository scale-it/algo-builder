import { types as rtypes } from "@algo-builder/runtime";
import type { LogicSig } from "algosdk";
import { Algodv2, ConfirmedTxInfo, LogicSigArgs } from "algosdk";

import { txWriter } from "../../src/internal/tx-log-writer";
import { AlgoOperator } from "../../src/lib/algo-operator";
import {
  ASAInfo,
  ASCCache,
  FundASCFlags,
  LsigInfo,
  SSCInfo
} from "../../src/types";

export class AlgoOperatorDryRunImpl implements AlgoOperator {
  get algodClient (): Algodv2 {
    throw new Error("Not implemented");
  };

  getDelegatedLsig (lsig: string): Object | undefined {
    throw new Error("Not implemented");
  }

  getAssetByID (assetIndex: number | bigint): Promise<import("algosdk").AssetInfo> {
    throw new Error("Not implemented");
  }

  sendAndWait (rawTxns: Uint8Array | Uint8Array[]): Promise<ConfirmedTxInfo> {
    throw new Error("Not implemented");
  }

  waitForConfirmation (txId: string): Promise<import("algosdk").ConfirmedTxInfo> {
    throw new Error("Not implemented");
  }

  async deployASA (
    name: string, asaDef: rtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap,
    txnWriter: txWriter): Promise<ASAInfo> {
    return {
      creator: flags.creator.addr + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      assetIndex: -1,
      confirmedRound: -1,
      assetDef: asaDef
    };
  }

  async fundLsig (
    name: string, flags: FundASCFlags, payFlags: rtypes.TxParams,
    txnWriter: txWriter, scInitParam?: unknown): Promise<LsigInfo> {
    return {
      creator: flags.funder.addr + "-get-address-dry-run",
      contractAddress: "dfssdfsd",
      lsig: {} as LogicSig
    };
  }

  async deploySSC (
    approvalProgram: string,
    clearProgram: string,
    flags: rtypes.SSCDeploymentFlags,
    payFlags: rtypes.TxParams,
    txWriter: txWriter,
    scInitParam?: unknown): Promise<SSCInfo> {
    return {
      creator: flags.sender.addr + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      confirmedRound: -1,
      appID: -1
    };
  }

  async ensureCompiled (name: string, force?: boolean, scInitParam?: unknown): Promise<ASCCache> {
    return {
      filename: name,
      timestamp: 1010, // compilation time (Unix time)
      compiled: "ASDF", // the compiled code
      compiledHash: "ASDF", // hash returned by the compiler
      srcHash: 123, // source code hash
      base64ToBytes: new Uint8Array(1) // compiled base64 in bytes
    };
  }

  optInAcountToASA (
    asaName: string, assetIndex: number, account: rtypes.Account,
    params: rtypes.TxParams): Promise<void> {
    throw new Error("Method not implemented.");
  }

  optInLsigToASA (
    asaName: string, assetIndex: number, lsig: LogicSig, flags: rtypes.TxParams
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  optInAccountToSSC (
    sender: rtypes.Account, index: number,
    payFlags: rtypes.TxParams, flags: rtypes.SSCOptionalFlags): Promise<void> {
    throw new Error("Method not implemented.");
  }

  optInLsigToSSC (
    appId: number, lsig: LogicSig,
    payFlags: rtypes.TxParams, flags: rtypes.SSCOptionalFlags): Promise<void> {
    throw new Error("Method not implemented.");
  }

  optInToASAMultiple (
    asaName: string, asaDef: rtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap, assetIndex: number
  ): Promise<void> {
    return Promise.resolve();
  }
}
