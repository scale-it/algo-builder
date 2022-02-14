import { types as rtypes } from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";
import { Account, Algodv2, LogicSigAccount, modelsv2 } from "algosdk";

import { txWriter } from "../../src/internal/tx-log-writer";
import { AlgoOperator } from "../../src/lib/algo-operator";
import {
  ASCCache,
  ConfirmedTxInfo,
  FundASCFlags,
  LsigInfo
} from "../../src/types";
import { MOCK_APPLICATION_ADDRESS, mockAlgod, mockAssetInfo, mockConfirmedTx } from "../mocks/tx";

export class AlgoOperatorDryRunImpl implements AlgoOperator {
  get algodClient (): Algodv2 {
    return mockAlgod;
  };

  getDelegatedLsigByFile (lsig: string): Object | undefined {
    throw new Error("Not implemented");
  }

  getAssetByID (assetIndex: number | bigint): Promise<modelsv2.Asset> {
    return new Promise((resolve, reject) => {
      assetIndex === 1n ? resolve(mockAssetInfo) : reject(new Error("Not implemented"));
    });
  }

  sendAndWait (rawTxns: Uint8Array | Uint8Array[]): Promise<ConfirmedTxInfo> {
    return new Promise((resolve, reject) => {
      resolve(mockConfirmedTx);
    });
  }

  /* eslint-disable sonarjs/no-identical-functions */
  waitForConfirmation (txId: string): Promise<ConfirmedTxInfo> {
    return new Promise((resolve, reject) => {
      resolve(mockConfirmedTx);
    });
  }

  async deployASA (
    name: string, asaDef: wtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap,
    txnWriter: txWriter): Promise<rtypes.ASAInfo> {
    return {
      creator: String(flags.creator.addr) + "-get-address-dry-run",
      txId: "tx-id-dry-run",
      assetIndex: 1,
      confirmedRound: -1,
      assetDef: asaDef,
      deleted: false
    };
  }

  async fundLsig (
    lsig: LogicSigAccount | string, flags: FundASCFlags, payFlags: wtypes.TxParams,
    txnWriter: txWriter, scInitParam?: unknown): Promise<LsigInfo> {
    return {
      creator: String(flags.funder.addr) + "-get-address-dry-run",
      contractAddress: "dfssdfsd",
      lsig: {} as LogicSigAccount
    };
  }

  async deployApp (
    approvalProgram: string,
    clearProgram: string,
    flags: rtypes.AppDeploymentFlags,
    payFlags: wtypes.TxParams,
    txWriter: txWriter,
    scInitParam?: unknown,
    appName?: string): Promise<rtypes.SSCInfo> {
    return {
      creator: String(flags.sender.addr) + "-get-address-dry-run",
      applicationAccount: MOCK_APPLICATION_ADDRESS,
      txId: "tx-id-dry-run",
      confirmedRound: -1,
      appID: 33,
      timestamp: 1,
      deleted: false,
      approvalFile: "approval-file.py",
      clearFile: "clear-file.py"
    };
  }

  async updateApp (
    sender: Account,
    payFlags: wtypes.TxParams,
    appID: number,
    newApprovalProgram: string,
    newClearProgram: string,
    flags: rtypes.AppOptionalFlags,
    txWriter: txWriter
  ): Promise<rtypes.SSCInfo> {
    return {
      creator: String(sender.addr) + "-get-address-dry-run",
      applicationAccount: MOCK_APPLICATION_ADDRESS,
      txId: "tx-id-dry-run",
      confirmedRound: -1,
      appID: 33,
      timestamp: 2,
      deleted: false,
      approvalFile: "approval-file.py",
      clearFile: "clear-file.py"
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

  optInAccountToASA (
    asaName: string, assetIndex: number, account: rtypes.Account,
    params: wtypes.TxParams): Promise<void> {
    return new Promise((resolve, reject) => { resolve(); });
  }

  optInLsigToASA (
    asaName: string, assetIndex: number, lsig: LogicSigAccount, flags: wtypes.TxParams
  ): Promise<void> {
    return new Promise((resolve, reject) => { resolve(); });
  }

  optInAccountToApp (
    sender: rtypes.Account, index: number,
    payFlags: wtypes.TxParams, flags: rtypes.AppOptionalFlags): Promise<void> {
    return new Promise((resolve, reject) => { resolve(); });
  }

  optInLsigToApp (
    appID: number, lsig: LogicSigAccount,
    payFlags: wtypes.TxParams, flags: rtypes.AppOptionalFlags): Promise<void> {
    return new Promise((resolve, reject) => { resolve(); });
  }

  optInToASAMultiple (
    asaName: string, asaDef: wtypes.ASADef,
    flags: rtypes.ASADeploymentFlags, accounts: rtypes.AccountMap, assetIndex: number
  ): Promise<void> {
    return Promise.resolve();
  }
}
