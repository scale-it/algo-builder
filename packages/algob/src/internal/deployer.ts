import { overrideASADef, types as rtypes } from "@algo-builder/runtime";
import type { LogicSig, LogicSigArgs, MultiSig, MultisigMetadata } from "algosdk";
import * as algosdk from "algosdk";

import { txWriter } from "../internal/tx-log-writer";
import { AlgoOperator } from "../lib/algo-operator";
import { getDummyLsig, getLsig } from "../lib/lsig";
import { blsigExt, loadBinaryMultiSig, readMsigFromFile } from "../lib/msig";
import { persistCheckpoint } from "../lib/script-checkpoints";
import type {
  ASAInfo,
  ASCCache,
  CheckpointRepo,
  Deployer,
  FundASCFlags,
  LsigInfo,
  RuntimeEnv,
  SCParams,
  SSCInfo
} from "../types";
import { BuilderError } from "./core/errors";
import { ERRORS } from "./core/errors-list";
import { DeployerConfig } from "./deployer_cfg";

// Base class for deployer Run Mode (read access) and Deploy Mode (read and write access)
class DeployerBasicMode {
  protected readonly runtimeEnv: RuntimeEnv;
  protected readonly cpData: CheckpointRepo;
  protected readonly loadedAsaDefs: rtypes.ASADefs;
  protected readonly algoOp: AlgoOperator;
  protected readonly txWriter: txWriter;
  readonly accounts: rtypes.Account[];
  readonly accountsByName: rtypes.AccountMap;

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

  private _getAccount (name: string): rtypes.Account {
    const found = this.accountsByName.get(name);
    if (!found) {
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.ACCOUNT_NOT_FOUND, {
          assetName: name
        });
    }
    return found;
  }

  /**
   * Returns asset definition for given name
   * @param name Asset name
   */
  getASADef (name: string, asaParams?: Partial<rtypes.ASADef>): rtypes.ASADef {
    return overrideASADef(this.accountsByName, this.loadedAsaDefs[name], asaParams);
  }

  getCheckpointKV (key: string): string | undefined {
    return this.cpData.getMetadata(this.networkName, key);
  }

  isDefined (name: string): boolean {
    return this.cpData.isDefined(this.networkName, name);
  }

  get asa (): Map<string, ASAInfo> {
    return this.cpData.precedingCP[this.networkName]?.asa ?? new Map();
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
   * Loads deployed Asset Definition from checkpoint.
   * NOTE: This function returns "deployed" ASADef, as immutable properties
   * of asaDef could be updated during tx execution (eg. update asset clawback)
   * @param asaName asset name in asa.yaml
   */
  loadASADef (asaName: string): rtypes.ASADef | undefined {
    const asaMap = this.cpData.precedingCP[this.networkName]?.asa ?? new Map();
    return asaMap.get(asaName)?.assetDef;
  }

  /**
   * Loads stateful smart contract info from checkpoint
   * @param nameApproval Approval program name
   * @param nameClear clear program name
   */
  getSSC (nameApproval: string, nameClear: string): SSCInfo | undefined {
    const resultMap = this.cpData.precedingCP[this.networkName]?.ssc ?? new Map();
    return resultMap.get(nameApproval + "-" + nameClear);
  }

  /**
   * Loads a single signed delegated logic signature from checkpoint
   */
  getDelegatedLsig (lsigName: string): LogicSig | undefined {
    const resultMap = this.cpData.precedingCP[this.networkName]?.dLsig ?? new Map(); ;
    const result = resultMap.get(lsigName)?.lsig;
    if (result === undefined) { return undefined; }
    const lsig = getDummyLsig();
    Object.assign(lsig, result);
    if (lsig.sig) { lsig.sig = Uint8Array.from(lsig.sig); };
    return lsig;
  }

  /**
   * Loads logic signature for contract mode
   * @param name ASC name
   * @param scParams: Smart contract parameters used for calling smart contract
   * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
   * @returns loaded logic signature from assets/<file_name>.teal
   */
  async loadLogic (name: string, scParams: LogicSigArgs, scTmplParams?: SCParams): Promise<LogicSig> {
    return await getLsig(name, this.algoOp.algodClient, scParams, scTmplParams);
  }

  /**
   * Loads multisigned logic signature from .lsig or .blsig file
   * @param name filename
   * @param scParams parameters
   * @returns multi signed logic signature from assets/<file_name>.(b)lsig
   */
  async loadMultiSig (name: string, scParams: LogicSigArgs): Promise<LogicSig> {
    if (name.endsWith(blsigExt)) { return await loadBinaryMultiSig(name); }

    const lsig = await getLsig(name, this.algoOp.algodClient, scParams); // get lsig from .teal (getting logic part from lsig)
    const msig = await readMsigFromFile(name); // Get decoded Msig object from .msig
    Object.assign(lsig.msig = {} as MultiSig, msig);
    return lsig;
  }

  /**
   * Appends signature (using signer's sk) to multi-signed logic signature. If multisig is not found
   * then new multisig is created
   * eg. appending own signature to a signed lsig (received from multisignature account address network)
   * @param lsig Logic Sig object
   * @param signer: Signer Account which will sign the smart contract
   * @param mparams: passed when signing a new multisig
   * @returns multi signed logic signature (with appended signature from signer's sk)
   */
  signLogicSigMultiSig (lsig: LogicSig, signer: rtypes.Account, mparams?: MultisigMetadata): LogicSig {
    if (lsig.msig === undefined) { // if multisig not found, create new msig
      if (mparams === undefined) {
        throw new Error('MultiSig Metadata is undefined, which is required for single sign multisig');
      }
      lsig.sign(signer.sk, mparams);
    } else {
      lsig.appendToMultisig(signer.sk); // else append signature to msig
    }
    return lsig;
  }

  /**
   * Opt-In to ASA for a single account. The opt-in transaction is
   * signed by account secret key
   * @param asaName ASA name
   * @param accountName
   * @param flags Transaction flags
   */
  async optInAcountToASA (asaName: string, accountName: string, flags: rtypes.TxParams): Promise<void> {
    await this.algoOp.optInAcountToASA(
      asaName,
      this._getASAInfo(asaName).assetIndex,
      this._getAccount(accountName),
      flags);
  }

  /**
   * Description: Opt-In to ASA for a contract account (represented by logic signture).
   * The opt-in transaction is signed by the logic signature
   * @param asaName ASA name
   * @param lsig logic signature
   * @param flags Transaction flags
   */
  async optInLsigToASA (asaName: string, lsig: LogicSig, flags: rtypes.TxParams): Promise<void> {
    await this.algoOp.optInLsigToASA(asaName, this._getASAInfo(asaName).assetIndex, lsig, flags);
  }

  /**
   * Opt-In to stateful smart contract (SSC) for a single account
   * @param sender sender account
   * @param appID application index
   * @param payFlags Transaction flags
   * @param flags Optional parameters to SSC (accounts, args..)
   */
  async optInToSSC (
    sender: rtypes.Account,
    appId: number,
    payFlags: rtypes.TxParams,
    flags: rtypes.SSCOptionalFlags): Promise<void> {
    await this.algoOp.optInToSSC(sender, appId, payFlags, flags);
  }

  /**
   * Returns ASCCache (with compiled code)
   * @param name: Smart Contract filename (must be present in assets folder)
   * @param force: if force is true file will be compiled for sure, even if it's checkpoint exist
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  async ensureCompiled (name: string, force?: boolean, scTmplParams?: SCParams): Promise<ASCCache> {
    return await this.algoOp.ensureCompiled(name, force, scTmplParams);
  }
}

/**
 * This class is what user interacts with in deploy task
 */
export class DeployerDeployMode extends DeployerBasicMode implements Deployer {
  get isDeployMode (): boolean {
    return true;
  }

  addCheckpointKV (key: string, value: string): void {
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

  /**
   * Asserts if asset is not already present in checkpoint
   * @param name Asset name
   */
  assertNoAsset (name: string): void {
    if (this.isDefined(name)) {
      this.persistCP();
      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASSET_ALREADY_PRESENT, {
          assetName: name
        });
    }
  }

  /**
   * Persist checkpoint till current call.
   */
  persistCP (): void {
    persistCheckpoint(this.txWriter.scriptName, this.cpData.strippedCP);
  }

  /**
   * Register ASA Info in checkpoints
   */
  registerASAInfo (asaName: string, asaInfo: ASAInfo): void {
    this.cpData.registerASA(this.networkName, asaName, asaInfo);
  }

  /**
   * Register SSC Info in checkpoints
   */
  registerSSCInfo (sscName: string, sscInfo: SSCInfo): void {
    this.cpData.registerSSC(this.networkName, sscName, sscInfo);
  }

  /**
   * Log transaction with message using txwriter
   */
  logTx (message: string, txConfirmation: algosdk.ConfirmedTxInfo): void {
    this.txWriter.push(message, txConfirmation);
  }

  async deployASA (
    name: string,
    flags: rtypes.ASADeploymentFlags,
    asaParams?: Partial<rtypes.ASADef>
  ): Promise<ASAInfo> {
    const asaDef = overrideASADef(this.accountsByName, this.loadedAsaDefs[name], asaParams);

    if (asaDef === undefined) {
      this.persistCP();

      throw new BuilderError(
        ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_DEF_NOT_FOUND, {
          asaName: name
        });
    }
    this.assertNoAsset(name);
    let asaInfo = {} as ASAInfo;
    try {
      asaInfo = await this.algoOp.deployASA(
        name, asaDef, flags, this.accountsByName, this.txWriter);
    } catch (error) {
      this.persistCP();

      console.log(error);
      throw error;
    }

    this.registerASAInfo(name, asaInfo);

    try {
      await this.algoOp.optInToASAMultiple(
        name,
        asaDef,
        flags,
        this.accountsByName,
        asaInfo.assetIndex);
    } catch (error) {
      this.persistCP();

      console.log(error);
      throw error;
    }

    return asaInfo;
  }

  /**
   * This function will send Algos to ASC account in "Contract Mode"
   * @param name     - ASC filename
   * @param flags    - Deployments flags (as per SPEC)
   * @param payFlags - as per SPEC
   * @param scParams: Smart contract parameters (used while calling smart contract)
   * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
   */
  async fundLsig (name: string, flags: FundASCFlags,
    payFlags: rtypes.TxParams, scParams: LogicSigArgs, scTmplParams?: SCParams): Promise<void> {
    try {
      await this.algoOp.fundLsig(name, flags, payFlags, this.txWriter, scParams, scTmplParams);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  /**
   * Create and sign (using signer's sk) a logic signature for "delegated approval". Then save signed lsig
   * info to checkpoints (in /artifacts)
   * https://developer.algorand.org/docs/features/asc1/stateless/sdks/#account-delegation-sdk-usage
   * @param name: Stateless Smart Contract filename (must be present in assets folder)
   * @param signer: Signer Account which will sign the smart contract
   * @param scParams: Smart contract Parameters(Used while calling smart contract)
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  async mkDelegatedLsig (
    name: string, signer: rtypes.Account,
    scParams: LogicSigArgs, scTmplParams?: SCParams): Promise<LsigInfo> {
    this.assertNoAsset(name);
    let lsigInfo = {} as any;
    try {
      const lsig = await getLsig(name, this.algoOp.algodClient, scParams, scTmplParams);
      lsig.sign(signer.sk);
      lsigInfo = {
        creator: signer.addr,
        contractAddress: lsig.address(),
        lsig: lsig
      };
    } catch (error) {
      this.persistCP();

      console.log(error);
      throw error;
    }
    this.cpData.registerLsig(this.networkName, name, lsigInfo);
    return lsigInfo;
  }

  /**
   * Deploys Algorand Stateful Smart Contract
   * @param approvalProgram filename which has approval program
   * @param clearProgram filename which has clear program
   * @param flags SSCDeploymentFlags
   * @param payFlags Transaction Params
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  async deploySSC (
    approvalProgram: string,
    clearProgram: string,
    flags: rtypes.SSCDeploymentFlags,
    payFlags: rtypes.TxParams,
    scTmplParams?: SCParams): Promise<SSCInfo> {
    const name = approvalProgram + "-" + clearProgram;
    this.assertNoAsset(name);
    let sscInfo = {} as any;
    try {
      sscInfo = await this.algoOp.deploySSC(
        approvalProgram, clearProgram, flags, payFlags, this.txWriter, scTmplParams);
    } catch (error) {
      this.persistCP();

      console.log(error);
      throw error;
    }

    this.registerSSCInfo(name, sscInfo);

    return sscInfo;
  }
}

/**
 * This class is what user interacts with in run task mode
 */
export class DeployerRunMode extends DeployerBasicMode implements Deployer {
  get isDeployMode (): boolean {
    return false;
  }

  persistCP (): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "persistCP"
    });
  }

  assertNoAsset (name: string): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "assertNoAsset"
    });
  }

  registerASAInfo (name: string, asaInfo: ASAInfo): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "registerASAInfo"
    });
  }

  registerSSCInfo (name: string, sscInfo: SSCInfo): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "registerSSCInfo"
    });
  }

  logTx (message: string, txConfirmation: algosdk.ConfirmedTxInfo): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "logTx"
    });
  }

  addCheckpointKV (_key: string, _value: string): void {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "addCheckpointKV"
    });
  }

  async deployASA (_name: string, _flags: rtypes.ASADeploymentFlags): Promise<ASAInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deployASA"
    });
  }

  async fundLsig (_name: string, _flags: FundASCFlags,
    _payFlags: rtypes.TxParams, _scParams: LogicSigArgs, _scInitParams?: unknown): Promise<LsigInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "fundLsig"
    });
  }

  async mkDelegatedLsig (_name: string, _signer: rtypes.Account,
    _scParams: LogicSigArgs, _scInitParams?: unknown): Promise<LsigInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "delegatedLsig"
    });
  }

  async deploySSC (
    approvalProgram: string,
    clearProgram: string,
    flags: rtypes.SSCDeploymentFlags,
    payFlags: rtypes.TxParams,
    scInitParam?: unknown): Promise<SSCInfo> {
    throw new BuilderError(ERRORS.BUILTIN_TASKS.DEPLOYER_EDIT_OUTSIDE_DEPLOY, {
      methodName: "deploySSC"
    });
  }
}
