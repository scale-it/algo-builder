
import { Algodv2 } from "algosdk";

import { AlgoOperator } from "../../src/lib/algo-operator";
import {
  Account,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  ASCCache,
  ASCDeploymentFlags,
  ASCInfo,
  ASCPaymentFlags
} from "../../src/types";

export class AlgoOperatorDryRunImpl implements AlgoOperator {
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

  async deployASC (
    name: string, scParams: Object, flags: ASCDeploymentFlags, payFlags: ASCPaymentFlags
  ): Promise<ASCInfo> {
    return {
      creator: flags.funder.addr + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      confirmedRound: -1,
      contractAddress: "dfssdfsd",
      logicSignature: "12dsfdsdasd"
    };
  }

  async ensureCompiled (name: string, force: boolean): Promise<ASCCache> {
    return {
      filename: name,
      timestamp: 1010, // compilation time (Unix time)
      compiled: "ASDF", // the compiled code
      compiledHash: "ASDF", // hash returned by the compiler
      srcHash: 123 // source code hash
    };
  }
}
