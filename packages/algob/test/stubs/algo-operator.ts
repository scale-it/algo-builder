import type { LogicSig } from "algosdk";
import { Algodv2, LogicSigArgs } from "algosdk";

import { txWriter } from "../../src/internal/tx-log-writer";
import { AlgoOperator } from "../../src/lib/algo-operator";
import {
  Account,
  AccountMap,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  ASCCache,
  FundASCFlags,
  LsigInfo,
  SSCDeploymentFlags,
  SSCInfo,
  SSCOptionalFlags,
  TxParams
} from "../../src/types";

export class AlgoOperatorDryRunImpl implements AlgoOperator {
  get algodClient (): Algodv2 {
    throw new Error("Not implemented");
  };

  getDelegatedLsig (lsig: string): Object | undefined {
    throw new Error("Not implemented");
  }

  waitForConfirmation (txId: string): Promise<import("algosdk").ConfirmedTxInfo> {
    throw new Error("Not implemented");
  }

  async deployASA (
    name: string, asaDesc: ASADef, flags: ASADeploymentFlags, accounts: AccountMap,
    txnWriter: txWriter): Promise<ASAInfo> {
    return {
      creator: flags.creator.addr + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      assetIndex: -1,
      confirmedRound: -1
    };
  }

  async fundLsig (
    name: string, flags: FundASCFlags, payFlags: TxParams,
    txnWriter: txWriter, scParams: LogicSigArgs, scInitParam?: unknown): Promise<LsigInfo> {
    return {
      creator: flags.funder.addr + "-get-address-dry-run",
      contractAddress: "dfssdfsd",
      lsig: {} as LogicSig
    };
  }

  async deploySSC (
    approvalProgram: string,
    clearProgram: string,
    flags: SSCDeploymentFlags,
    payFlags: TxParams,
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

  optInToASA (asaName: string, assetIndex: number, account: Account, params: TxParams): Promise<void> {
    throw new Error("Method not implemented.");
  }

  optInToSSC (
    sender: Account, index: number, payFlags: TxParams, flags: SSCOptionalFlags): Promise<void> {
    throw new Error("Method not implemented.");
  }

  optInToASAMultiple (
    asaName: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: AccountMap, assetIndex: number
  ): Promise<void> {
    return Promise.resolve();
  }
}
