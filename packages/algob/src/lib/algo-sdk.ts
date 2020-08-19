import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  Account,
  AlgobDeployer,
  AlgobRuntimeEnv,
  ASAInfo,
  ASCInfo,
  CheckpointRepo,
  ASADeploymentFlags,
  ASADef,
  ASADefs
} from "../types";
import { loadASAFile } from "../lib/asa"
import algosdk from "algosdk";
import * as t from "./tx";

export interface AlgoSDKWrapper {
  deployASA(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo>
}

export class AlgoSDKWrapperDryRunImpl implements AlgoSDKWrapper {
  async deployASA(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    return { creator: account.addr + "-get-address" }
  }
}

export class AlgoSDKWrapperImpl implements AlgoSDKWrapper {
  private readonly algoClient: algosdk.Algodv2;

  constructor(algoClient: algosdk.Algodv2) {
    this.algoClient = algoClient
  }

  async deployASA(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    const tx = t.makeAssetCreateTxn(asaDesc, flags, account)
    console.log("tx:", tx)
    throw new Error("TODO:MM Not implemented")
  }
}

