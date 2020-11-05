import * as algosdk from "algosdk";

import type {
  Account,
  AlgobDeployer,
  ASADeploymentFlags,
  ASAInfo,
  FundASCFlags,
  LogicSig,
  LsigInfo, SSCDeploymentFlags,
  SSCInfo,
  TxParams
} from "../../src/types";

export class FakeDeployer implements AlgobDeployer {
  asa = new Map<string, ASAInfo>();
  ssc = new Map<string, SSCInfo>();
  lsig = new Map<string, LsigInfo>();
  isDeployMode = false;
  accounts = [];
  accountsByName = new Map<string, Account>();
  scriptName = '';

  setScriptName (name: string): void {
    this.scriptName = name;
  }

  log (msg: string, obj: any): void {
    throw new Error("Not implemented");
  }

  getDelegatedLsig (lsig: string): object | undefined {
    throw new Error("Not implemented");
  }

  async loadLsig (name: string, scParams: Object): Promise<LogicSig> {
    throw new Error("Not implemented");
  }

  loadBinaryMultiSig (name: string, scParams: Object): Promise<LogicSig> {
    throw new Error("Not implemented");
  }

  loadMultiSig (name: string, scParams: Object): Promise<LogicSig> {
    throw new Error("Not implemented");
  }

  putMetadata (key: string, value: string): void {
  };

  getMetadata (key: string): string | undefined {
    return "metadata";
  };

  async deployASA (name: string, flags: ASADeploymentFlags): Promise<ASAInfo> {
    throw new Error("Not implemented");
  };

  async fundLsig (name: string, scParams: object, flags: FundASCFlags): Promise<void> {
    throw new Error("Not implemented");
  }

  async mkDelegatedLsig (name: string, scParams: object, signer: Account): Promise<LsigInfo> {
    throw new Error("Not implemented");
  }

  async deploySSC (
    approvalProgram: string,
    clearProgram: string,
    flags: SSCDeploymentFlags,
    payFlags: TxParams): Promise<SSCInfo> {
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

  optInToASA (name: string, accountName: string, flags: ASADeploymentFlags): Promise<void> {
    throw new Error("Not implemented");
  }
}
