import type { LogicSig, LogicSigArgs, MultiSig } from "algosdk";
import * as algosdk from "algosdk";

import { txWriter } from "../internal/tx-log-writer";
import { AlgoOperator } from "../lib/algo-operator";
import { getDummyLsig, getLsig } from "../lib/lsig";
import { blsigExt, loadBinaryMultiSig, readMsigFromFile } from "../lib/msig";
import { persistCheckpoint } from "../lib/script-checkpoints";
import type {
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
import { DeployerConfig } from "./deployer_cfg";

// Base class for deployer Run Mode (read access) and Deploy Mode (read and write access)
class DeployerBasicMode {
  protected readonly runtimeEnv: AlgobRuntimeEnv;
  protected readonly cpData: CheckpointRepo;
  protected readonly loadedAsaDefs: ASADefs;
  protected readonly algoOp: AlgoOperator;
  protected readonly txWriter: txWriter;
  readonly accounts: Account[];
  readonly accountsByName: Accounts;

  constructor (deployerCfg: DeployerConfig) {
    this.runtimeEnv = deployerCfg.runtimeEnv;
    this.cpData = deployerCfg.cpData;
    this.loadedAsaDefs = deployerCfg.asaDefs;
    this.algoOp = deployerCfg.algoOp;
    this.accounts = deployerCfg.runtimeEnv.network.config.accounts;
    this.accountsByName = deployerCfg.accounts;
    this.txWriter = deployerCfg.txWriter;
  }

  protected get networkName (): string {
    return this.runtimeEnv.network.name;
  }

  getMetadata (key: string): string | undefined {
    return this.cpData.getMetadata(this.networkName, key);
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

  get algodClient (): algosdk.Algodv2 {
    return this.algoOp.algodClient;
  }

  async waitForConfirmation (txId: string): Promise<algosdk.ConfirmedTxInfo> {
    return await this.algoOp.waitForConfirmation(txId);
  }

  log (msg: string, obj: any): void {
    this.txWriter.push(msg, obj);
  }

  /**
   * @param lsigName Description: loads and returns delegated logic signature from checkpoint
   */
  getDelegatedLsig (lsigName: string): LogicSig | undefined {
    const resultMap = this.cpData.precedingCP[this.networkName]?.dLsig ?? new Map(); ;
    const result = resultMap.get(lsigName)?.lsig;
    if (result === undefined) { return undefined; }
    const lsig = getDummyLsig();
    Object.assign(lsig, result);
    return lsig;
  }

  /**
   * Description : loads logic signature for contract mode
   * @param name ASC name
   * @param scParams parameters
   * @returns {LogicSig} loaded logic signature from assets/<file_name>.teal
   */
  async loadLogic (name: string, scParams: LogicSigArgs): Promise<LogicSig> {
    return await getLsig(name, scParams, this.algoOp.algodClient);
  }

  /**
   * Description : loads multisigned logic signature from .lsig or .blsig file
   * @param {string} name filename
   * @param {LogicSigArgs} scParams parameters
   * @returns {LogicSig} multi signed logic signature from assets/<file_name>.(b)lsig
   */
  async loadMultiSig (name: string, scParams: LogicSigArgs): Promise<LogicSig> {
    if (name.endsWith(blsigExt)) { return await loadBinaryMultiSig(name); }

    const lsig = await getLsig(name, scParams, this.algoOp.algodClient); // get lsig from .teal (getting logic part from lsig)
    const msig = await readMsigFromFile(name); // Get decoded Msig object from .msig
    Object.assign(lsig.msig = {} as MultiSig, msig);
    return lsig;
  }
}

// This class is what user interacts with in deploy task
export class DeployerDeployMode extends DeployerBasicMode implements AlgobDeployer {
  get isDeployMode (): boolean {
    return true;
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
   * @param name     - ASC filename
   * @param scParams - SC parameters
   * @param flags    - Deployments flags (as per SPEC)
   * @param payFlags - as per SPEC
   */
  async fundLsig (name: string, scParams: LogicSigArgs, flags: FundASCFlags,
    payFlags: TxParams): Promise<void> {
    try {
      await this.algoOp.fundLsig(name, scParams, flags, payFlags, this.txWriter);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  /**
   * Description - This function will create and sign a logic signature for "delegated approval".
   * https://developer.algorand.org/docs/features/asc1/stateless/sdks/#account-delegation-sdk-usage
   * @param name     - ASC name
   * @param scParams - SC parameters
   * @param signer   - signer
   */
  async mkDelegatedLsig (name: string, scParams: LogicSigArgs, signer: Account): Promise<LsigInfo> {
    this.assertNoAsset(name);
    let lsigInfo = {} as any;
    try {
      const lsig = await getLsig(name, scParams, this.algoOp.algodClient);
      lsig.sign(signer.sk);
      lsigInfo = {
        creator: signer.addr,
        contractAddress: lsig.address(),
        lsig: lsig
      };
    } catch (error) {
      persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);

      console.log(error);
      throw error;
    }
    this.cpData.registerLsig(this.networkName, name, lsigInfo);
    return lsigInfo;
  }

  async optInToASA (name: string, accountName: string, flags: TxParams): Promise<void> {
    await this.algoOp.optInToASA(
      name,
      this._getASAInfo(name).assetIndex,
      this._getAccount(accountName),
      flags);
  }
}

// This class is what user interacts with in run task
export class DeployerRunMode extends DeployerBasicMode implements AlgobDeployer {
  get isDeployMode (): boolean {
    return false;
  }

  putMetadata (_key: string, _value: string): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "putMetadata"
    });
  }

  async deployASA (_name: string, _flags: ASADeploymentFlags): Promise<ASAInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASA"
    });
  }

  async fundLsig (_name: string, _scParams: LogicSigArgs, _flags: FundASCFlags,
    _payFlags: TxParams): Promise<LsigInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "fundLsig"
    });
  }

  async mkDelegatedLsig (_name: string, _scParams: LogicSigArgs, _signer: Account): Promise<LsigInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "delegatedLsig"
    });
  }

  optInToASA (_name: string, _accountName: string, _flags: ASADeploymentFlags): Promise<void> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "optInToASA"
    });
  }
}
