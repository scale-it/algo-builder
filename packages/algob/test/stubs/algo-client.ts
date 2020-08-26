
import { AlgoDeployClient } from "../../src/lib/algo-client";
import { Account, ASADef, ASADeploymentFlags, ASAInfo, Network } from "../../src/types";

export function createDeployClientStub (_network: Network): AlgoDeployClient {
  return new AlgoClientDryRunImpl();
}

export class AlgoClientDryRunImpl implements AlgoDeployClient {
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
