
import { decode, encode } from "@msgpack/msgpack";
import * as algosdk from "algosdk";

import { txWriter } from "../internal/tx-log-writer";
import { AlgoOperator } from "../lib/algo-operator";
import { getLsig, logicsig } from "../lib/lsig";
import { persistCheckpoint } from "../lib/script-checkpoints";
import {
  Account,
  Accounts,
  AlgobDeployer,
  AlgobRuntimeEnv,
  ASADefs,
  ASADeploymentFlags,
  ASAInfo,
  ASCInfo,
  CheckpointRepo,
  FundASCFlags,
  LsigInfo,
  TxParams
} from "../types";
import { BuilderError } from "./core/errors";
import { ERRORS } from "./core/errors-list";
// const logicsig = require("algosdk/src/logicsig");
// This class is what user interacts with in deploy task
export class DeployerDeployMode implements AlgobDeployer {
  private readonly runtimeEnv: AlgobRuntimeEnv;
  private readonly cpData: CheckpointRepo;
  private readonly loadedAsaDefs: ASADefs;
  private readonly algoOp: AlgoOperator;
  private readonly txWriter: txWriter;
  readonly accounts: Account[];
  readonly accountsByName: Accounts;

  constructor (
    runtimeEnv: AlgobRuntimeEnv,
    cpData: CheckpointRepo,
    asaDefs: ASADefs,
    algoOp: AlgoOperator,
    accountsByName: Accounts,
    txWriter: txWriter
  ) {
    this.runtimeEnv = runtimeEnv;
    this.cpData = cpData;
    this.loadedAsaDefs = asaDefs;
    this.algoOp = algoOp;
    this.accounts = runtimeEnv.network.config.accounts;
    this.accountsByName = accountsByName;
    this.txWriter = txWriter;
  }

  get isDeployMode (): boolean {
    return true;
  }

  private get networkName (): string {
    return this.runtimeEnv.network.name;
  }

  putMetadata (key: string, value: string): void {
    const found = this.cpData.getMetadata(this.networkName, key);
    if (found === value) {
      return;
    }
    if (found) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_METADATA_ALREADY_PRESENT, {
          metadataKey: key
        });
    }
    this.cpData.putMetadata(this.networkName, key, value);
  }

  getMetadata (key: string): string | undefined {
    return this.cpData.getMetadata(this.networkName, key);
  }

  private assertNoAsset (name: string): void {
    if (this.isDefined(name)) {
      persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT, {
          assetName: name
        });
    }
  }

  private _getASAInfo (name: string): ASAInfo {
    const found = this.asa.get(name);
    if (!found) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_NOT_DEFINED, {
          assetName: name
        });
    }
    return found;
  }

  private _getAccount (name: string): Account {
    const found = this.accountsByName.get(name);
    if (!found) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.ACCOUNT_NOT_FOUND, {
          assetName: name
        });
    }
    return found;
  }

  async deployASA (name: string, flags: ASADeploymentFlags): Promise<ASAInfo> {
    if (this.loadedAsaDefs[name] === undefined) {
      persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_DEF_NOT_FOUND, {
          asaName: name
        });
    }
    this.assertNoAsset(name);
    let asaInfo = {} as any;
    try {
      asaInfo = await this.algoOp.deployASA(
        name, this.loadedAsaDefs[name], flags, this.accountsByName, this.txWriter);
    } catch (error) {
      persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);

      console.log(error);
      throw error;
    }

    this.cpData.registerASA(this.networkName, name, asaInfo);

    try {
      await this.algoOp.optInToASAMultiple(
        name,
        this.loadedAsaDefs[name],
        flags,
        this.accountsByName,
        asaInfo.assetIndex);
    } catch (error) {
      persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);

      console.log(error);
      throw error;
    }

    return asaInfo;
  }

  /**
   * Description - This function will send Algos to ASC account in "Contract Mode"
   * @param name     - ASC name
   * @param scParams - SC parameters
   * @param flags    - Deployments flags (as per SPEC)
   * @param payFlags - as per SPEC
   */
  async fundLsig (name: string, scParams: Object, flags: FundASCFlags,
    payFlags: TxParams): Promise<LsigInfo> {
    this.assertNoAsset(name);
    let lsigInfo = {} as any;
    try {
      lsigInfo = await this.algoOp.fundLsig(name, scParams, flags, payFlags, this.txWriter);
    } catch (error) {
      persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);

      console.log(error);
      throw error;
    }
    this.cpData.registerLsig(this.networkName, name, lsigInfo);
    return lsigInfo;
  }

  /**
   * Description - This function will create logic signature for "delegated approval"
   * @param name     - ASC name
   * @param scParams - SC parameters
   * @param signer   - signer
   */
  async delegatedLsig (name: string, scParams: Object, signer: Account): Promise<LsigInfo> {
    this.assertNoAsset(name);
    let lsigInfo = {} as any;
    try {
      const lsig = await getLsig(name, scParams, this.algoOp.algodClient);
      lsig.sign(signer.sk);
      lsigInfo = {
        creator: signer.addr,
        contractAddress: lsig.address(),
        logicSignature: encode(lsig)
      };
    } catch (error) {
      persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);

      console.log(error);
      throw error;
    }
    this.cpData.registerLsig(this.networkName, name, lsigInfo);
    return lsigInfo;
  }

  isDefined (name: string): boolean {
    return this.cpData.isDefined(this.networkName, name);
  }

  get asa (): Map<string, ASAInfo> {
    return this.cpData.precedingCP[this.networkName]?.asa ?? new Map();
  }

  get asc (): Map<string, ASCInfo> {
    return this.cpData.precedingCP[this.networkName]?.asc ?? new Map();
  }

  get lsig (): Map<string, LsigInfo> {
    return this.cpData.precedingCP[this.networkName]?.lsig ?? new Map();
  }

  get algodClient (): algosdk.Algodv2 {
    return this.algoOp.algodClient;
  }

  async waitForConfirmation (txId: string): Promise<algosdk.ConfirmedTxInfo> {
    return await this.algoOp.waitForConfirmation(txId);
  }

  async optInToASA (name: string, accountName: string, flags: TxParams): Promise<void> {
    await this.algoOp.optInToASA(
      name,
      this._getASAInfo(name).assetIndex,
      this._getAccount(accountName),
      flags);
  }

  log (msg: string, obj: any): void {
    this.txWriter.push(msg, obj);
  }

  getDelegatedLsig (lsigName: string): Object | undefined {
    const result = this.lsig.get(lsigName)?.logicSignature;
    if (result === undefined) { return undefined; }
    const lsig1 = decode(result);
    const dummyProgram = new Uint8Array([
      1, 32, 2, 1, 100, 38, 1, 32, 213, 3, 149,
      22, 62, 136, 178, 191, 199, 92, 201, 183, 175, 213,
      79, 155, 211, 71, 149, 158, 180, 205, 247, 164, 218,
      202, 87, 77, 111, 133, 236, 77, 49, 16, 34, 18,
      49, 7, 40, 18, 16, 49, 8, 35, 14, 16
    ]);
    const lsig = new logicsig.LogicSig(dummyProgram, []);
    Object.assign(lsig, lsig1);
    return lsig;
  }
}

// This class is what user interacts with in run task
export class DeployerRunMode implements AlgobDeployer {
  private readonly _internal: AlgobDeployer;
  private readonly txWriter: txWriter;

  constructor (deployer: AlgobDeployer, txWriter: txWriter) {
    this._internal = deployer;
    this.txWriter = txWriter;
  }

  get accounts (): Account[] {
    return this._internal.accounts;
  }

  get accountsByName (): Accounts {
    return this._internal.accountsByName;
  }

  get isDeployMode (): boolean {
    return false;
  }

  putMetadata (_key: string, _value: string): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "putMetadata"
    });
  }

  getMetadata (key: string): string | undefined {
    return this._internal.getMetadata(key);
  }

  async deployASA (_name: string, _flags: ASADeploymentFlags): Promise<ASAInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASA"
    });
  }

  async fundLsig (_name: string, scParams: Object, flags: FundASCFlags,
    payFlags: TxParams): Promise<LsigInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "fundLsig"
    });
  }

  async delegatedLsig (_name: string, scParams: Object, signer: Account): Promise<LsigInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "delegatedLsig"
    });
  }

  isDefined (name: string): boolean {
    return this._internal.isDefined(name);
  }

  get asa (): Map<string, ASAInfo> {
    return this._internal.asa;
  }

  get asc (): Map<string, ASCInfo> {
    return this._internal.asc;
  }

  get lsig (): Map<string, LsigInfo> {
    return this._internal.lsig;
  }

  get algodClient (): algosdk.Algodv2 {
    return this._internal.algodClient;
  }

  async waitForConfirmation (txId: string): Promise<algosdk.ConfirmedTxInfo> {
    return await this._internal.waitForConfirmation(txId);
  }

  optInToASA (name: string, accountName: string, flags: ASADeploymentFlags): Promise<void> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "optInToASA"
    });
  }

  log (msg: string, obj: any): void {
    this.txWriter.push(msg, obj);
  }

  getDelegatedLsig (lsigName: string): Object | undefined {
    return this._internal.getDelegatedLsig(lsigName);
  }
}
