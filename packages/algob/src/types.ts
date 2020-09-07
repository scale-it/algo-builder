import type { Account as AccountSDK } from "algosdk";
import * as algosdk from "algosdk";
import { DeepReadonly, StrictOmit } from "ts-essentials";
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
  chainName?: string
  kmdAddresses?: Promise<AccountSDK[]>
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

export type UserPaths = StrictOmit<Partial<ProjectPaths>, "configFile">;

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
  userConfig: DeepReadonly<AlgobConfig>
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

type AccountAddress = string;

export interface DeployedAssetInfo {
  creator: AccountAddress
  txId: string
  confirmedRound: number
}

export interface ASAInfo extends DeployedAssetInfo {
  assetIndex: number
}
export interface ASCInfo extends DeployedAssetInfo {
  contractAddress: string
  logicSignature: string
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

  putMetadata: (networkName: string, key: string, value: string) => CheckpointRepo
  getMetadata: (networkName: string, key: string) => string | undefined

  registerASA: (networkName: string, name: string, info: ASAInfo) => CheckpointRepo
  registerASC: (networkName: string, name: string, info: ASCInfo) => CheckpointRepo

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
  asc: Map<string, ASCInfo>
};

export type ASADef = z.infer<typeof ASADefSchema>;
export type ASADefs = z.infer<typeof ASADefsSchema>;

export interface TxParams {
  // feePerByte or totalFee is used to set the appropriate transaction fee parameter.
  // SDK expects`fee: number` and boolean `flatFee`. But the API expects only one parameter:
  // `fee` Here we use feePerByte and totalFee - both as numberic parameters. We think that
  // this is more explicit. If both are specified, totalFee takes precedence.
  feePerByte?: number
  totalFee?: number
  firstValid?: number
  validRounds?: number
}

export interface ASADeploymentFlags extends TxParams {
  creator: Account
}

export interface ASCPaymentFlags extends TxParams {
  rawTxParamsAmt? : number
  closeToRemainder?: string
  note?: string
  lease?: string
}

export interface ASCDeploymentFlags {
  funder: Account
  fundingMicroAlgo: number
}

export interface AssetScriptMap {
  [assetName: string]: string
}

export type Accounts = Map<string, Account>;

export interface AlgobDeployer {
  // Allows user to know whether it's possible to mutate this instance
  isDeployMode: boolean
  accounts: Account[]
  accountsByName: Accounts
  putMetadata: (key: string, value: string) => void
  getMetadata: (key: string) => string | undefined
  deployASA: (name: string, flags: ASADeploymentFlags) => Promise<ASAInfo>
  deployASC: (name: string, scParams: Object, flags: ASCDeploymentFlags,
    payFlags: ASCPaymentFlags) => Promise<ASCInfo>
  /**
     Returns true if ASA or ACS were deployed in any script.
     Checks even for checkpoints out of from the execution
     session which are not obtainable using get methods.
  */
  isDefined: (name: string) => boolean
  asa: Map<string, ASAInfo>
  asc: Map<string, ASCInfo>

  // Not present in the spec:
  algodClient: algosdk.Algodv2
  waitForConfirmation: (txId: string) => Promise<algosdk.ConfirmedTxInfo>
}

// ************************
//     Asset types

export interface ASCCache {
  filename: string
  timestamp: number // compilation time (Unix time)
  compiled: string // the compiled code
  compiledHash: string // hash returned by the compiler
  srcHash: number // source code hash
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
