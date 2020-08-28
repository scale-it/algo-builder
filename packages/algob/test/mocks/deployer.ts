import * as algosdk from "algosdk";

import { Account, AccountDef, AlgobDeployer, ASADeploymentFlags, ASAInfo, ASCInfo } from "../../src/types";

export class FakeDeployer implements AlgobDeployer {
  asa = new Map<string, ASAInfo>();
  isDeployMode = false;
  accounts = [];
  accountsByName = new Map<string, Account>();
  putMetadata (key: string, value: string): void {
  };

  getMetadata (key: string): string | undefined {
    return "metadata";
  };

  async deployASA (name: string, flags: ASADeploymentFlags): Promise<ASAInfo> {
    throw new Error("Not implemented");
  };

  async deployASC (name: string, source: string, account: AccountDef): Promise<ASCInfo> {
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
}
