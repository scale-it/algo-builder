import * as t from "io-ts";
import { Context, getFunctionName, ValidationError } from "io-ts/lib";
import { Reporter } from "io-ts/lib/Reporter";

import { BUILDEREVM_NETWORK_NAME } from "../../constants";
import { BuilderError } from "../errors";
import { ERRORS } from "../errors-list";

function stringify(v: any): string {
  if (typeof v === "function") {
    return getFunctionName(v);
  }
  if (typeof v === "number" && !isFinite(v)) {
    if (isNaN(v)) {
      return "NaN";
    }
    return v > 0 ? "Infinity" : "-Infinity";
  }
  return JSON.stringify(v);
}

function getContextPath(context: Context): string {
  const keysPath = context
    .slice(1)
    .map((c: any) => c.key)
    .join(".");

  return `${context[0].type.name}.${keysPath}`;
}

function getMessage(e: ValidationError): string {
  const lastContext = e.context[e.context.length - 1];

  return e.message !== undefined
    ? e.message
    : getErrorMessage(
        getContextPath(e.context),
        e.value,
        lastContext.type.name
      );
}

function getErrorMessage(path: string, value: any, expectedType: string) {
  return `Invalid value ${stringify(
    value
  )} for ${path} - Expected a value of type ${expectedType}.`;
}

export function failure(es: ValidationError[]): string[] {
  return es.map(getMessage);
}

export function success(): string[] {
  return [];
}

export const DotPathReporter: Reporter<string[]> = {
  report: (validation: any) => validation.fold(failure, success),
};

function optional<TypeT, OutputT>(
  codec: t.Type<TypeT, OutputT, unknown>,
  name: string = `${codec.name} | undefined`
): t.Type<TypeT | undefined, OutputT | undefined, unknown> {
  return new t.Type(
    name,
    (u: unknown): u is TypeT | undefined => u === undefined || codec.is(u),
    (u: any, c: any) => (u === undefined ? t.success(u) : codec.validate(u, c)),
    (a: any) => (a === undefined ? undefined : codec.encode(a))
  );
}

// IMPORTANT: This t.types MUST be kept in sync with the actual types.

const BuilderNetworkAccount = t.type({
  privateKey: t.string,
  balance: t.string,
});

const BuilderNetworkConfig = t.type({
  hardfork: optional(t.string),
  chainId: optional(t.number),
  from: optional(t.string),
  gas: optional(t.union([t.literal("auto"), t.number])),
  gasPrice: optional(t.union([t.literal("auto"), t.number])),
  gasMultiplier: optional(t.number),
  accounts: optional(t.array(BuilderNetworkAccount)),
  blockGasLimit: optional(t.number),
  throwOnTransactionFailures: optional(t.boolean),
  throwOnCallFailures: optional(t.boolean),
  loggingEnabled: optional(t.boolean),
  allowUnlimitedContractSize: optional(t.boolean),
  initialDate: optional(t.string),
});

const HDAccountsConfig = t.type({
  mnemonic: t.string,
  initialIndex: optional(t.number),
  count: optional(t.number),
  path: optional(t.string),
});

const OtherAccountsConfig = t.type({
  type: t.string,
});

const NetworkConfigAccounts = t.union([
  t.literal("remote"),
  t.array(t.string),
  HDAccountsConfig,
  OtherAccountsConfig,
]);

const HttpHeaders = t.record(t.string, t.string, "httpHeaders");

const HttpNetworkConfig = t.type({
  chainId: optional(t.number),
  from: optional(t.string),
  gas: optional(t.union([t.literal("auto"), t.number])),
  gasPrice: optional(t.union([t.literal("auto"), t.number])),
  gasMultiplier: optional(t.number),
  url: optional(t.string),
  accounts: optional(NetworkConfigAccounts),
  httpHeaders: optional(HttpHeaders),
});

const NetworkConfig = t.union([BuilderNetworkConfig, HttpNetworkConfig]);

const Networks = t.record(t.string, NetworkConfig);

const ProjectPaths = t.type({
  root: optional(t.string),
  cache: optional(t.string),
  artifacts: optional(t.string),
  sources: optional(t.string),
  tests: optional(t.string),
});

const EVMVersion = t.string;

const SolcOptimizerConfig = t.type({
  enabled: optional(t.boolean),
  runs: optional(t.number),
});

const SolcConfig = t.type({
  version: optional(t.string),
  optimizer: optional(SolcOptimizerConfig),
  evmVersion: optional(EVMVersion),
});

const AnalyticsConfig = t.type({
  enabled: optional(t.boolean),
});

const BuilderConfig = t.type(
  {
    defaultNetwork: optional(t.string),
    networks: optional(Networks),
    paths: optional(ProjectPaths),
    solc: optional(SolcConfig),
    analytics: optional(AnalyticsConfig),
  },
  "BuilderConfig"
);

/**
 * Validates the config, throwing a BuilderError if invalid.
 * @param config
 */
export function validateConfig(config: any) {
  const errors = getValidationErrors(config);

  if (errors.length === 0) {
    return;
  }

  let errorList = errors.join("\n  * ");
  errorList = `  * ${errorList}`;

  throw new BuilderError(ERRORS.GENERAL.INVALID_CONFIG, { errors: errorList });
}

export function getValidationErrors(config: any): string[] {
  const errors = [];

  // These can't be validated with io-ts
  if (config !== undefined && typeof config.networks === "object") {
    const builderNetwork = config.networks[BUILDEREVM_NETWORK_NAME];
    if (builderNetwork !== undefined) {
      // TODO: MM validate network config vars here

      if (
        builderNetwork.allowUnlimitedContractSize !== undefined &&
        typeof builderNetwork.allowUnlimitedContractSize !== "boolean"
      ) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.allowUnlimitedContractSize`,
            builderNetwork.allowUnlimitedContractSize,
            "boolean | undefined"
          )
        );
      }

      if (
        builderNetwork.initialDate !== undefined &&
        typeof builderNetwork.initialDate !== "string"
      ) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.initialDate`,
            builderNetwork.initialDate,
            "string | undefined"
          )
        );
      }

      if (
        builderNetwork.throwOnTransactionFailures !== undefined &&
        typeof builderNetwork.throwOnTransactionFailures !== "boolean"
      ) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.throwOnTransactionFailures`,
            builderNetwork.throwOnTransactionFailures,
            "boolean | undefined"
          )
        );
      }

      if (
        builderNetwork.throwOnCallFailures !== undefined &&
        typeof builderNetwork.throwOnCallFailures !== "boolean"
      ) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.throwOnCallFailures`,
            builderNetwork.throwOnCallFailures,
            "boolean | undefined"
          )
        );
      }

      if (builderNetwork.url !== undefined) {
        errors.push(
          `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME} can't have an url`
        );
      }

      if (
        builderNetwork.blockGasLimit !== undefined &&
        typeof builderNetwork.blockGasLimit !== "number"
      ) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.blockGasLimit`,
            builderNetwork.blockGasLimit,
            "number | undefined"
          )
        );
      }

      if (
        builderNetwork.chainId !== undefined &&
        typeof builderNetwork.chainId !== "number"
      ) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.chainId`,
            builderNetwork.chainId,
            "number | undefined"
          )
        );
      }

      if (
        builderNetwork.loggingEnabled !== undefined &&
        typeof builderNetwork.loggingEnabled !== "boolean"
      ) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.loggingEnabled`,
            builderNetwork.loggingEnabled,
            "boolean | undefined"
          )
        );
      }

      if (builderNetwork.accounts !== undefined) {
        if (Array.isArray(builderNetwork.accounts)) {
          for (const account of builderNetwork.accounts) {
            if (typeof account.privateKey !== "string") {
              errors.push(
                getErrorMessage(
                  `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.accounts[].privateKey`,
                  account.privateKey,
                  "string"
                )
              );
            }

            if (typeof account.balance !== "string") {
              errors.push(
                getErrorMessage(
                  `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.accounts[].balance`,
                  account.balance,
                  "string"
                )
              );
            }
          }
        } else {
          errors.push(
            getErrorMessage(
              `BuilderConfig.networks.${BUILDEREVM_NETWORK_NAME}.accounts`,
              builderNetwork.accounts,
              "[{privateKey: string, balance: string}] | undefined"
            )
          );
        }
      }
    }

    for (const [networkName, netConfig] of Object.entries<any>(
      config.networks
    )) {
      if (networkName === BUILDEREVM_NETWORK_NAME) {
        continue;
      }

      if (networkName === "localhost" && netConfig.url === undefined) {
        continue;
      }

      if (typeof netConfig.url !== "string") {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${networkName}.url`,
            netConfig.url,
            "string"
          )
        );
      }

      const netConfigResult = HttpNetworkConfig.decode(netConfig);
      if ((netConfigResult as any).isLeft()) {
        errors.push(
          getErrorMessage(
            `BuilderConfig.networks.${networkName}`,
            netConfig,
            "HttpNetworkConfig"
          )
        );
      }
    }
  }

  // io-ts can get confused if there are errors that it can't understand.
  // Especially around BuilderEVM's config. It will treat it as an HTTPConfig,
  // and may give a loot of errors.
  if (errors.length > 0) {
    return errors;
  }

  const result = BuilderConfig.decode(config);

  if ((result as any).isRight()) {
    return errors;
  }

  const ioTsErrors = DotPathReporter.report(result);
  return [...errors, ...ioTsErrors];
}
