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
import { AlgoSDKWrapper } from "./algo-sdk"

// This class is what user interacts with in deploy task
export class AlgobDeployerImpl implements AlgobDeployer {
  private readonly runtimeEnv: AlgobRuntimeEnv;
  private readonly cpData: CheckpointRepo;
  private readonly loadedAsaDefs: ASADefs;
  private readonly algoSDK: AlgoSDKWrapper;

  constructor(runtimeEnv: AlgobRuntimeEnv, cpData: CheckpointRepo, asaDefs: ASADefs, algoSdk: AlgoSDKWrapper) {
    this.runtimeEnv = runtimeEnv;
    this.cpData = cpData;
    this.loadedAsaDefs = asaDefs;
    this.algoSDK = algoSdk
  }

  get accounts(): Account[] {
    return this.runtimeEnv.network.config.accounts;
  }

  get isWriteable(): boolean {
    return true;
  }

  private get networkName(): string {
    return this.runtimeEnv.network.name;
  }

  putMetadata(key: string, value: string): void {
    if (this.cpData.getMetadata(this.networkName, key) === value) {
      return;
    }
    if (this.cpData.getMetadata(this.networkName, key)) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_METADATA_ALREADY_PRESENT, {
        metadataKey: key
      });
    }
    this.cpData.putMetadata(this.networkName, key, value);
  }

  getMetadata(key: string): string | undefined {
    return this.cpData.getMetadata(this.networkName, key);
  }

  private assertNoAsset(name: string): void {
    if (this.isDefined(name)) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT, {
        assetName: name
      });
    }
  }

  async deployASA(name: string, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    if (this.loadedAsaDefs[name] === undefined) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_DEF_NOT_FOUND, {
          asaName: name
        });
    }
    return this.deployASADirect(name, this.loadedAsaDefs[name], flags, account)
  }

  async deployASADirect(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    this.assertNoAsset(name);
    const asaInfo = await this.algoSDK.deployASA(name, asaDesc, flags, account)
    this.cpData.registerASA(this.networkName, name, asaInfo);
    return this.cpData.precedingCP[this.networkName].asa[name];
  }

  async deployASC(name: string, source: string, account: Account): Promise<ASCInfo> {
    this.assertNoAsset(name);
    this.cpData.registerASC(this.networkName, name, { creator: account.addr + "-get-address" });
    return this.cpData.precedingCP[this.networkName].asc[name];
  }

  isDefined(name: string): boolean {
    return this.cpData.isDefined(this.networkName, name);
  }
}

// This class is what user interacts with in run task
export class AlgobDeployerReadOnlyImpl implements AlgobDeployer {
  private readonly _internal: AlgobDeployer;

  constructor(deployer: AlgobDeployer) {
    this._internal = deployer;
  }

  get accounts(): Account[] {
    return this._internal.accounts;
  }

  get isWriteable(): boolean {
    return false;
  }

  putMetadata(key: string, value: string): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "putMetadata"
    });
  }

  getMetadata(key: string): string | undefined {
    return this._internal.getMetadata(key);
  }

  async deployASA(name: string, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASA"
    });
  }

  async deployASADirect(name: string, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<ASAInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASA"
    });
  }

  async deployASAFromFile(source: string, account: Account): Promise<ASAInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASAFromFile"
    });
  }

  async deployASC(name: string, source: string, account: Account): Promise<ASCInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASC"
    });
  }

  isDefined(name: string): boolean {
    return this._internal.isDefined(name);
  }
}
