import { DeepReadonly, StrictOmit } from "ts-essentials";

import * as types from "./internal/core/params/argument-types";

// Begin config types

// IMPORTANT: This t.types MUST be kept in sync with the actual types.

export interface HDAccountsConfig {
  mnemonic: string;
  initialIndex?: number;
  count?: number;
  path?: string;
}

export type NetworkAccounts =
  | string[]
  | HDAccountsConfig;

interface CommonNetworkConfig {
  accounts?: NetworkAccounts;
  chainName?: string;
  //from?: string;
  // TODO: timeout?: number;
}

export interface AlgobChainCfg extends CommonNetworkConfig {
  throwOnTransactionFailures?: boolean;
  throwOnCallFailures?: boolean;
  loggingEnabled?: boolean;
  initialDate?: string;
}

export interface HttpNetworkConfig extends CommonNetworkConfig {
  url?: string;
  httpHeaders?: { [name: string]: string };
}

export type NetworkConfig = AlgobChainCfg | HttpNetworkConfig;

export interface Networks {
  [networkName: string]: NetworkConfig;
}

/**
 * The project paths:
 * * root: the project's root.
 * * configFile: the builder's config filepath.
 * * cache: project's cache directory.
 * * artifacts: artifact's directory.
 * * sources: project's sources directory.
 * * tests: project's tests directory.
 */
export interface ProjectPaths {
  root: string;
  configFile: string;
  cache: string;
  artifacts: string;
  sources: string;
  tests: string;
}

export type UserPaths = StrictOmit<Partial<ProjectPaths>, "configFile">;

export interface AlgobConfig {
  networks?: Networks;
  paths?: UserPaths;
  mocha?: Mocha.MochaOptions;
}

export interface ResolvedAlgobConfig extends AlgobConfig {
  paths?: ProjectPaths;
  networks: Networks;
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
  [name: string]: TaskDefinition;
}

export interface ConfigurableTaskDefinition {
  setDescription(description: string): this;

  setAction(action: ActionType<TaskArguments>): this;

  addParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ): this;

  addOptionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ): this;

  addPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ): this;

  addOptionalPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T,
    type?: types.ArgumentType<T>
  ): this;

  addVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: types.ArgumentType<T>,
    isOptional?: boolean
  ): this;

  addOptionalVariadicPositionalParam<T>(
    name: string,
    description?: string,
    defaultValue?: T[],
    type?: types.ArgumentType<T>
  ): this;

  addFlag(name: string, description?: string): this;
}

export interface ParamDefinition<T> {
  name: string;
  defaultValue?: T;
  type: types.ArgumentType<T>;
  description?: string;
  isOptional: boolean;
  isFlag: boolean;
  isVariadic: boolean;
}

export type ParamDefinitionAny = ParamDefinition<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface OptionalParamDefinition<T> extends ParamDefinition<T> {
  defaultValue: T;
  isOptional: true;
}

export interface ParamDefinitionsMap {
  [paramName: string]: ParamDefinitionAny;
}

/**
 * Algob arguments:
 * * network: the network to be used (default="default").
 * * showStackTraces: flag to show stack traces.
 * * version: flag to show builder's version.
 * * help: flag to show builder's help message.
 * * config: used to specify builder's config file.
 */
export interface RuntimeArgs {
  network: string;
  showStackTraces: boolean;
  version: boolean;
  help: boolean;
  config?: string;
  verbose: boolean;
}

export type AlgobParamDefinitions = {
  [param in keyof Required<RuntimeArgs>]: OptionalParamDefinition<
    RuntimeArgs[param]
  >;
};

export interface TaskDefinition extends ConfigurableTaskDefinition {
  readonly name: string;
  readonly description?: string;
  readonly action: ActionType<TaskArguments>;
  readonly isInternal: boolean;

  // TODO: Rename this to something better. It doesn't include the positional
  // params, and that's not clear.
  readonly paramDefinitions: ParamDefinitionsMap;

  readonly positionalParamDefinitions: Array<ParamDefinitionAny>;
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
export type TaskArguments = any;  // eslint-disable-line @typescript-eslint/no-explicit-any

export type RunTaskFunction = (
  name: string,
  taskArguments?: TaskArguments
) => PromiseAny;

export interface RunSuperFunction<ArgT extends TaskArguments> {
  (taskArguments?: ArgT): PromiseAny;
  isDefined: boolean;
}

export type ActionType<ArgsT extends TaskArguments> = (
  taskArgs: ArgsT,
  env: AlgobRuntimeEnv,
  runSuper: RunSuperFunction<ArgsT>
) => PromiseAny;

export interface Network {
  name: string;
  config: NetworkConfig;
  //provider:
}

export interface AlgobRuntimeEnv {
  readonly config: ResolvedAlgobConfig;
  readonly runtimeArgs: RuntimeArgs;
  readonly tasks: TasksMap;
  readonly run: RunTaskFunction;
  readonly network: Network;
  //readonly ethereum: EthereumProvider; // DEPRECATED: Use network.provider
}

export interface Artifact {
  contractName: string;
  abi: any;  // eslint-disable-line @typescript-eslint/no-explicit-any
  bytecode: string; // "0x"-prefixed hex string
  deployedBytecode: string; // "0x"-prefixed hex string
  linkReferences: LinkReferences;
  deployedLinkReferences: LinkReferences;
}

export interface LinkReferences {
  [libraryFileName: string]: {
    [libraryName: string]: Array<{ length: number; start: number }>;
  };
}


// ************************
//     helper types

export interface StrMap {
  [key: string]: string
}

export interface AnyMap {
  [key: string]: any  // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type PromiseAny = Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

//  LocalWords:  configFile
