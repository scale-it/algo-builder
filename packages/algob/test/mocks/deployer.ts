import * as algosdk from "algosdk";

import { Account, AlgobDeployer, ASADeploymentFlags, ASAInfo, ASCDeploymentFlags, ASCInfo } from "../../src/types";

export class FakeDeployer implements AlgobDeployer {
  asa = new Map<string, ASAInfo>();
  asc = new Map<string, ASCInfo>();
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

  async deployASC (name: string, scParams: object, flags: ASCDeploymentFlags): Promise<ASCInfo> {
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
