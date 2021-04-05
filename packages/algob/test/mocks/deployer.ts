import { types as rtypes } from "@algo-builder/runtime";
import type { LogicSig, LogicSigArgs } from "algosdk";
import * as algosdk from "algosdk";

import type {
  ASAInfo,
  ASCCache,
  Deployer,
  FundASCFlags,
  LsigInfo,
  SSCInfo
} from "../../src/types";

export class FakeDeployer implements Deployer {
  asa = new Map<string, ASAInfo>();
  ssc = new Map<string, SSCInfo>();
  lsig = new Map<string, LsigInfo>();
  isDeployMode = false;
  accounts = [];
  accountsByName = new Map<string, rtypes.Account>();
  scriptName = '';

  setScriptName (name: string): void {
    this.scriptName = name;
  }

  log (msg: string, obj: any): void {
    throw new Error("Not implemented");
  }

  getSSC (nameApproval: string, nameClear: string): SSCInfo | undefined {
    throw new Error("Not implemented");
  }

  getDelegatedLsig (lsig: string): object | undefined {
    throw new Error("Not implemented");
  }

  async loadLogic (name: string, scParams: LogicSigArgs, scInitParam?: unknown): Promise<LogicSig> {
    throw new Error("Not implemented");
  }

  loadMultiSig (name: string, scParams: Object): Promise<LogicSig> {
    throw new Error("Not implemented");
  }

  addCheckpointKV (key: string, value: string): void {
  };

  getCheckpointKV (key: string): string | undefined {
    return "metadata";
  };

  async deployASA (name: string, flags: rtypes.ASADeploymentFlags): Promise<ASAInfo> {
    throw new Error("Not implemented");
  };

  async fundLsig (name: string, flags: FundASCFlags,
    payFlags: rtypes.TxParams, scParams: LogicSigArgs, scInitParam?: unknown): Promise<void> {
    throw new Error("Not implemented");
  }

  async mkDelegatedLsig (name: string, signer: rtypes.Account,
    scParams: LogicSigArgs, scInitParam?: unknown): Promise<LsigInfo> {
    throw new Error("Not implemented");
  }

  async deploySSC (
    approvalProgram: string,
    clearProgram: string,
    flags: rtypes.SSCDeploymentFlags,
    payFlags: rtypes.TxParams): Promise<SSCInfo> {
    throw new Error("Not implemented");
  }

  async ensureCompiled (name: string, force?: boolean, scInitParam?: unknown): Promise<ASCCache> {
    throw new Error("Not implemented");
  }

  isDefined (name: string): boolean {
    return false;
  };

  get algodClient (): algosdk.Algodv2 {
    throw new Error("Not implemented");
  };

  waitForConfirmation (txId: string): Promise<algosdk.ConfirmedTxInfo> {
    throw new Error("Not implemented");
  }

  optInAcountToASA (name: string, accountName: string, flags: rtypes.TxParams): Promise<void> {
    throw new Error("Not implemented");
  }

  optInLsigToASA (asaName: string, lsig: LogicSig, flags: rtypes.TxParams): Promise<void> {
    throw new Error("Not implemented");
  }

  optInToSSC (
    sender: rtypes.Account, index: number, payFlags: rtypes.TxParams,
    flags: rtypes.SSCOptionalFlags): Promise<void> {
    throw new Error("Not implemented");
  }
}
