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

export interface AlgoSDKWrapper {
  deployASA(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo>
}

export class AlgoSDKWrapperDryRunImpl implements AlgoSDKWrapper {
  async deployASA(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    return { creator: account.addr + "-get-address" }
  }
}

export class AlgoSDKWrapperImpl implements AlgoSDKWrapper {

  constructor() {
  }

  async deployASA(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    throw new Error("TODO:MM Not implemented")
  }
}

