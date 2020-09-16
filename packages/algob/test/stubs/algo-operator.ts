
import { Algodv2 } from "algosdk";

import { txWriter } from "../../src/internal/tx-log-writer";
import { AlgoOperator } from "../../src/lib/algo-operator";
import {
  Account,
  Accounts,
  ASADef,
  ASADeploymentFlags,
  ASAInfo,
  ASCCache,
  ASCDeploymentFlags,
  ASCInfo,
  TxParams
} from "../../src/types";

export class AlgoOperatorDryRunImpl implements AlgoOperator {
  get algodClient (): Algodv2 {
    throw new Error("Not implemented");
  };

  waitForConfirmation (txId: string): Promise<import("algosdk").ConfirmedTxInfo> {
    throw new Error("Not implemented");
  }

  async deployASA (
    name: string, asaDesc: ASADef, flags: ASADeploymentFlags, accounts: Accounts,
    txWriter: txWriter): Promise<ASAInfo> {
    return {
      creator: flags.creator.addr + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      assetIndex: -1,
      confirmedRound: -1
    };
  }

  async deployASC (
    name: string, scParams: Object, flags: ASCDeploymentFlags, payFlags: TxParams,
    txWriter: txWriter): Promise<ASCInfo> {
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

  optInToASA (asaName: string, assetIndex: number, account: Account, params: TxParams): Promise<void> {
    throw new Error("Method not implemented.");
  }

  optInToASAMultiple (
    asaName: string, asaDef: ASADef, flags: ASADeploymentFlags, accounts: Accounts, assetIndex: number
  ): Promise<void> {
    return Promise.resolve();
  }
}
