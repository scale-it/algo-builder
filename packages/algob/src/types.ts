import type { Account as AccountSDK, LogicSig, LogicSigArgs } from "algosdk";
import * as algosdk from "algosdk";
import * as z from 'zod';

import * as types from "./internal/core/params/argument-types";
import { ASADefSchema, ASADefsSchema } from "./types-input";
// Begin config types

// IMPORTANT: This t.types MUST be kept in sync with the actual types.

export interface Account extends AccountSDK {
  // from AccountSDK: addr: string;
  //                  sk: Uint8Array
  name: string
}

export interface AlgobAccount {
  name: string
  mnemonic: string
}

export interface HDAccount {
  mnemonic: string
  initialIndex?: number
  count?: number
  path: string
}

export interface MnemonicAccount {
  name: string
  addr: string
  mnemonic: string
}

export type AccountDef =
  | MnemonicAccount
  | HDAccount
  | Account;

interface CommonNetworkConfig {
  accounts: Account[]
  // optional, when provided KMD accounts will be loaded by the config resolver
  // and merged into the accounts variable (above)
  kmdCfg?: KmdCfg
  chainName?: string
  // from?: string;
  // TODO: timeout?: number;
}

export interface AlgobChainCfg extends CommonNetworkConfig {
  throwOnTransactionFailures?: boolean
  throwOnCallFailures?: boolean
  loggingEnabled?: boolean
  initialDate?: string
}

export interface HttpNetworkConfig extends CommonNetworkConfig {
  host: string // with optional http o https prefix
  port: number
  token: string
  httpHeaders?: { [name: string]: string }
}

export type NetworkConfig = AlgobChainCfg | HttpNetworkConfig;

export interface Networks {
  [networkName: string]: NetworkConfig
}

export interface KmdWallet {
  name: string
  password: string
  accounts: Array<{name: string, address: string}> // both are obligatory
}

export interface KmdCfg {
  host: string
  port: number
  token: string
  wallets: KmdWallet[]
}

export interface NetworkCredentials {
  host: string
  port: number
  token: string
}

/**
 * The project paths:
 * * root: the project's root.
 * * configFile: the algob's config filepath.
 * * cache: project's cache directory.
 * * artifacts: artifact's directory.
 * * sources: project's sources directory.
 * * tests: project's tests directory.
 */
export interface ProjectPaths {
  root: string
  configFile: string
  cache: string
  artifacts: string
  sources: string
  tests: string
}

export type UserPaths = Omit<Partial<ProjectPaths>, "configFile">;

export interface AlgobConfig {
  networks?: Networks
  paths?: UserPaths
  mocha?: Mocha.MochaOptions
}

export interface ResolvedAlgobConfig extends AlgobConfig {
  paths?: ProjectPaths
  networks: Networks
}

// End config types

/**
 * A function that receives a AlgobRuntimeEnv and
 * modify its properties or add new ones.
 */
export type EnvironmentExtender = (env: AlgobRuntimeEnv) => void;

export type ConfigExtender = (
  config: ResolvedAlgobConfig,
  userConfig: Readonly<AlgobConfig>
) => void;

export interface TasksMap {
  [name: string]: TaskDefinition
}

export interface ConfigurableTaskDefinition {
  setDescription: (description: string) => this

  setAction: (action: ActionType<TaskArguments>) => this

  addParam: <T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ) => this

  addOptionalParam: <T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ) => this

  addPositionalParam: <T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ) => this

  addOptionalPositionalParam: <T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ) => this

  addVariadicPositionalParam: <T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ) => this

  addOptionalVariadicPositionalParam: <T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: types.ArgumentType<T>
  ) => this

  addFlag: (name: string, description?: string) => this
}

export interface ParamDefinition<T> {
  name: string
  shortName?: string
  defaultValue?: T
  type: types.ArgumentType<T>
  description?: string
  isOptional: boolean
  isFlag: boolean
  isVariadic: boolean
}

export type ParamDefinitionAny = ParamDefinition<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface OptionalParamDefinition<T> extends ParamDefinition<T> {
  defaultValue: T
  isOptional: true
}

export interface ParamDefinitionsMap {
  [paramName: string]: ParamDefinitionAny
}

/**
 * Algob arguments:
 * * network: the network to be used (default="default").
 * * showStackTraces: flag to show stack traces.
 * * version: flag to show algob's version.
 * * help: flag to show algob's help message.
 * * config: used to specify algob's config file.
 */
export interface RuntimeArgs {
  network: string
  showStackTraces: boolean
  version: boolean
  help: boolean
  config?: string
  verbose: boolean
}

export type AlgobParamDefinitions = {
  [param in keyof Required<RuntimeArgs>]: OptionalParamDefinition<
  RuntimeArgs[param]
  >;
};

export interface AlgobShortParamSubstitutions {
  [name: string]: string
};

export interface TaskDefinition extends ConfigurableTaskDefinition {
  readonly name: string
  readonly description?: string
  readonly action: ActionType<TaskArguments>
  readonly isInternal: boolean

  // TODO: Rename this to something better. It doesn't include the positional
  // params, and that's not clear.
  readonly paramDefinitions: ParamDefinitionsMap

  readonly positionalParamDefinitions: ParamDefinitionAny[]
}

/**
 * @type TaskArguments {object-like} - the input arguments for a task.
 *
 * TaskArguments type is set to 'any' because it's interface is dynamic.
 * It's impossible in TypeScript to statically specify a variadic
 * number of fields and at the same time define specific types for\
 * the argument values.
 *
 * For example, we could define:
 * type TaskArguments = Record<string, any>;
 *
 * ...but then, we couldn't narrow the actual argument value's type in compile time,
 * thus we have no other option than forcing it to be just 'any'.
 */
export type TaskArguments = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type RunTaskFunction = (
  name: string,
  taskArguments?: TaskArguments
) => PromiseAny;

export interface RunSuperFunction<ArgT extends TaskArguments> {
  (taskArguments?: ArgT): PromiseAny
  isDefined: boolean
}

export type ActionType<ArgsT extends TaskArguments> = (
  taskArgs: ArgsT,
  env: AlgobRuntimeEnv,
  runSuper: RunSuperFunction<ArgsT>
) => PromiseAny;

export interface Network {
  name: string
  config: NetworkConfig
  // provider:
}

export interface AlgobRuntimeEnv {
  readonly config: ResolvedAlgobConfig
  readonly runtimeArgs: RuntimeArgs
  readonly tasks: TasksMap
  readonly run: RunTaskFunction
  readonly network: Network
}

export interface Artifact {
  contractName: string
  abi: any // eslint-disable-line @typescript-eslint/no-explicit-any
  bytecode: string // "0x"-prefixed hex string
  deployedBytecode: string // "0x"-prefixed hex string
  linkReferences: LinkReferences
  deployedLinkReferences: LinkReferences
}

export interface LinkReferences {
  [libraryFileName: string]: {
    [libraryName: string]: Array<{ length: number, start: number }>
  }
}

export type AccountAddress = string;

export interface DeployedAssetInfo {
  creator: AccountAddress
  txId: string
  confirmedRound: number
}

// ASA deployment information (log)
export interface ASAInfo extends DeployedAssetInfo {
  assetIndex: number
}

// Stateful smart contract deployment information (log)
export interface SSCInfo extends DeployedAssetInfo {
  appID: number
}

// stateless smart contract deployment information (log)
export interface LsigInfo {
  creator: AccountAddress
  contractAddress: string
  lsig: LogicSig
}

export interface CheckpointRepo {
  // Three different checkpoint states are used for three different occasions.
  // During run of a script their values are changed in different ways.

  // Accumulates state as scripts are executed.
  // This way it hides values generated by remaining checkpoints.
  // It is what should be exposed to the running scripts.
  precedingCP: Checkpoints
  // Variables that current script introduced, short version of what was added.
  // Used for state persistence.
  strippedCP: Checkpoints
  // All possible values that are loaded in advance.
  // This allows to prevent asset name clashes between scripts.
  allCPs: Checkpoints

  merge: (curr: Checkpoints, scriptName: string) => CheckpointRepo
  mergeToGlobal: (curr: Checkpoints, scriptName: string) => CheckpointRepo

  /// sets metadata key-value for a specified network.
  putMetadata: (networkName: string, key: string, value: string) => CheckpointRepo
  /// gets metadata key-value for a specified network.
  getMetadata: (networkName: string, key: string) => string | undefined

  registerASA: (networkName: string, name: string, info: ASAInfo) => CheckpointRepo
  registerSSC: (networkName: string, name: string, info: SSCInfo) => CheckpointRepo
  registerLsig: (networkName: string, name: string, info: LsigInfo) => CheckpointRepo

  isDefined: (networkName: string, name: string) => boolean
  networkExistsInCurrentCP: (networkName: string) => boolean
};

export interface Checkpoints {
  [network: string]: Checkpoint
}

export interface Checkpoint {
  timestamp: number
  metadata: Map<string, string>
  asa: Map<string, ASAInfo>
  ssc: Map<string, SSCInfo>
  dLsig: Map<string, LsigInfo>
};

export type ASADef = z.infer<typeof ASADefSchema>;
export type ASADefs = z.infer<typeof ASADefsSchema>;

export type ExecParams = AlgoTransferParam | AssetTransferParam | SSCCallsParam;

export enum SignType {
  SecretKey,
  LogicSignature
}

export enum TransactionType {
  TransferAlgo,
  TransferAsset,
  CallNoOpSSC,
  ClearSSC,
  CloseSSC,
  DeleteSSC
}

export interface Sign {
  sign: SignType
  lsig?: LogicSig
}

export interface AlgoTransferParam extends Sign {
  type: TransactionType.TransferAlgo
  fromAccount: AccountSDK
  toAccountAddr: AccountAddress
  amountMicroAlgos: number
  payFlags: TxParams
}

export interface AssetTransferParam extends Sign {
  type: TransactionType.TransferAsset
  fromAccount: AccountSDK
  toAccountAddr: AccountAddress
  amount: number
  assetID: number
  payFlags: TxParams
}

export interface SSCCallsParam extends SSCOptionalFlags, Sign {
  type: TransactionType.CallNoOpSSC | TransactionType.ClearSSC |
  TransactionType.CloseSSC | TransactionType.DeleteSSC
  fromAccount: AccountSDK
  appId: number
  payFlags: TxParams
}

export interface TxParams {
  // feePerByte or totalFee is used to set the appropriate transaction fee parameter.
  // If both are set then totalFee takes precedence.
  // NOTE: SDK expects`fee: number` and boolean `flatFee`. But the API expects only one
  // on parameter: `fee`. Here, we define feePerByte and totalFee - both as numberic
  // parameters. We think that this is more explicit.
  feePerByte?: number
  totalFee?: number
  firstValid?: number
  validRounds?: number
  lease?: Uint8Array
  note?: string
  noteb64?: string
  closeRemainderTo?: AccountAddress
}

export interface ASADeploymentFlags extends TxParams {
  creator: Account
}

export interface FundASCFlags {
  funder: Account
  fundingMicroAlgo: number
}

// Stateful transaction optional parameters (accounts, args..)
export interface SSCOptionalFlags {
  appArgs?: Uint8Array[]
  accounts?: string[]
  foreignApps?: number[]
  foreignAssets?: number[]
  note?: Uint8Array
  lease?: Uint8Array
  rekeyTo?: string
}

// represent sender and schema of ssc
export interface SSCDeploymentFlags extends SSCOptionalFlags {
  sender: Account
  localInts: number
  localBytes: number
  globalInts: number
  globalBytes: number
}

export interface AssetScriptMap {
  [assetName: string]: string
}

export type AccountMap = Map<string, Account>;

export interface AlgobDeployer {
  // Allows user to know whether it's possible to mutate this instance
  isDeployMode: boolean
  accounts: Account[]
  accountsByName: AccountMap

  /**
  * Sets metadata key value for a current network in the chckpoint file based on the
  * current deployment script. If run in a non deployment mode (eg `algob run script_name.js`)
  * it will throw an exception.
  */
  addCheckpointKV: (key: string, value: string) => void

  /**
   * Queries metadata key in all checkpoint files of current network. If the key is not defined
   * in any checkpoint then `undefined` is returned. Can be run in both _run_ and _deploy_ mode.
   */
  getCheckpointKV: (key: string) => string | undefined

  /**
   * Description: Deploys ASA to the network
   * @param name:  ASA name - deployer will search for the ASA in the /assets/asa.yaml file
   * @param flags:  deployment flags
   */
  deployASA: (name: string, flags: ASADeploymentFlags) => Promise<ASAInfo>

  /**
   * Description: funds logic signature account
   * @param name: Stateless Smart Contract filename (must be present in assets folder)
   * @param payFlags: Transaction Parameters
   * @param scParams: Smart contract parameters (used while calling smart contract)
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  fundLsig: (
    name: string,
    flags: FundASCFlags,
    payFlags: TxParams,
    scParams: LogicSigArgs,
    scTmplParams?: StrMap
  ) => void

  /**
   * Description: Make delegated logic signature signed by signer
   * @param name: Stateless Smart Contract filename (must be present in assets folder)
   * @param signer: Signer Account which will sign the smart contract
   * @param scParams: Smart contract parameters (used while calling smart contract)
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  mkDelegatedLsig: (
    name: string,
    signer: Account,
    scParams: LogicSigArgs,
    scTmplParams?: StrMap
  ) => Promise<LsigInfo>

  /**
   * Description: Make delegated logic signature signed by signer
   * @param approvalProgram: approval program filename (must be present in assets folder)
   * @param clearProgram: clear program filename (must be present in assets folder)
   * @param flags: SSCDeploymentFlags
   * @param payFlags: Transaction Parameters
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  deploySSC: (
    approvalProgram: string,
    clearProgram: string,
    flags: SSCDeploymentFlags,
    payFlags: TxParams,
    scTmplParams?: StrMap) => Promise<SSCInfo>

  /**
     Returns true if ASA or DelegatedLsig or SSC were deployed in any script.
     Checks even for checkpoints which are out of scope from the execution
     session and are not obtainable using get methods.
  */
  isDefined: (name: string) => boolean

  // mapping of ASA name to deployment log
  asa: Map<string, ASAInfo>

  /** The functions are exposed only for users.
    * Put your logic into AlgoOperator if you need to interact with the chain **/

  algodClient: algosdk.Algodv2
  waitForConfirmation: (txId: string) => Promise<algosdk.ConfirmedTxInfo>

  // Output of these functions is undefined. It's not known what to save to CP
  optInToASA: (name: string, accountName: string, flags: ASADeploymentFlags) => Promise<void>
  optInToSSC: (sender: Account, index: number, payFlags: TxParams) => Promise<void>

  // Log Transaction
  log: (msg: string, obj: any) => void

  // extract multi signed logic signature file from assets/
  loadMultiSig: (name: string, scParams: LogicSigArgs) => Promise<LogicSig>

  // gets stateful smart contract info from checkpoint
  getSSC: (nameApproval: string, nameClear: string) => SSCInfo | undefined

  // gets a delegated logic signature from checkpoint
  getDelegatedLsig: (lsigName: string) => Object | undefined

  /**
   * Description: load contract mode logic signature (TEAL or PyTEAL)
   * @param name:  Smart Contract filename (must be present in assets folder)
   * @param scParams: Smart contract parameters (Used while calling smart contract)
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  loadLogic: (name: string, scParams: LogicSigArgs, scTmplParams?: StrMap) => Promise<LogicSig>

  /**
   * Description: Returns ASCCache (with compiled code)
   * @param name: Smart Contract filename (must be present in assets folder)
   * @param force: if force is true file will be compiled for sure, even if it's checkpoint exist
   * @param scTmplParams: scTmplParams: Smart contract template parameters
   *     (used only when compiling PyTEAL to TEAL)
   */
  ensureCompiled: (name: string, force?: boolean, scTmplParams?: StrMap) => Promise<ASCCache>
}

// ************************
//     Asset types

export interface ASCCache {
  filename: string
  timestamp: number // compilation time (Unix time)
  compiled: string // the compiled code
  compiledHash: string // hash returned by the compiler
  srcHash: number // source code hash
  toBytes: Uint8Array // compiled base64 in bytes
}

export interface PyASCCache extends ASCCache {
  tealCode: string
}

// ************************
//     helper types

export interface StrMap {
  [key: string]: string
}

export interface AnyMap {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type PromiseAny = Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

//  LocalWords:  configFile
