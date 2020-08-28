
import { Algodv2 } from "algosdk";

import { AlgoActions } from "../../src/lib/algo-actions";
import { Account, ASADef, ASADeploymentFlags, ASAInfo } from "../../src/types";

export class AlgoActionsDryRunImpl implements AlgoActions {
  get algodClient (): Algodv2 {
    throw new Error("Not implemented");
  };

  waitForConfirmation (txId: string): Promise<import("algosdk").ConfirmedTxInfo> {
    throw new Error("Not implemented");
  }

  async deployASA (
    name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account
  ): Promise<ASAInfo> {
    return {
      creator: account.addr + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      assetIndex: -1,
      confirmedRound: -1
    };
  }
}
