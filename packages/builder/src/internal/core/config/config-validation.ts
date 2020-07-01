import * as t from "io-ts";
import { pipe } from "fp-ts/lib/pipeable";
import { isRight, fold, isLeft } from "fp-ts/lib/Either";
import { Context, ValidationError } from "io-ts/lib";
import { Reporter } from "io-ts/lib/Reporter";

import { ALGOB_CHAIN_NAME } from "../../constants";
import { BuilderError } from "../errors";
import { ERRORS } from "../errors-list";
import { AlgobChainCfg } from "../../../types";
import CfgErrors, {mkErrorMessage} from "./config-errors";

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
    : mkErrorMessage(
        getContextPath(e.context),
        e.value,
        lastContext.type.name
      );
}


export function failure(es: ValidationError[]): string[] {
  return es.map(getMessage);
}

export function success(): string[] {
  return [];
}

export const DotPathReporter: Reporter<string[]> = {
  report: (validation: any) => pipe(validation, fold(failure, success)) ,
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

const AlgobChainCfg = t.type({
  // accounts: optional(t.array(todo)),
  chainName: optional(t.number),
  throwOnTransactionFailures: optional(t.boolean),
  throwOnCallFailures: optional(t.boolean),
  loggingEnabled: optional(t.boolean),
  initialDate: optional(t.string),
});

const HDAccountsConfig = t.type({
  mnemonic: t.string,
  initialIndex: optional(t.number),
  count: optional(t.number),
  path: optional(t.string),
});

const NetworkAccounts = t.union([
  t.array(t.string),
  HDAccountsConfig,
]);

const HttpHeaders = t.record(t.string, t.string, "httpHeaders");

const HttpNetworkConfig = t.type({
  chainName: optional(t.string),
  url: optional(t.string),
  accounts: optional(NetworkAccounts),
  httpHeaders: optional(HttpHeaders),
  // from: optional(t.string),
});

const NetworkConfig = t.union([AlgobChainCfg, HttpNetworkConfig]);

const Networks = t.record(t.string, NetworkConfig);

const ProjectPaths = t.type({
  root: optional(t.string),
  cache: optional(t.string),
  artifacts: optional(t.string),
  sources: optional(t.string),
  tests: optional(t.string),
});


const Config = t.type(
  {
    networks: optional(Networks),
    paths: optional(ProjectPaths),
  },
  "AlgobConfig"
);

/**
 * Validates the config, throwing a BuilderError if invalid.
 * @param config
 */
export function validateConfig(config: any) {
  const errors = getValidationErrors(config);

  if (errors.isEmpty()) {
    return;
  }

  const errorList = `  * ${errors.toString()}`;
  throw new BuilderError(ERRORS.GENERAL.INVALID_CONFIG, { errors: errorList });
}

export function getValidationErrors(config: any): CfgErrors {
  const errors = new CfgErrors();

  // These can't be validated with io-ts
  if (config !== undefined && typeof config.networks === "object") {
    for (const [net, ncfg] of Object.entries<any>(config.networks)) {
      if (net === ALGOB_CHAIN_NAME) {
        validateAlgobChainCfg(ncfg, errors);
        continue;
      }

      if (typeof ncfg.url !== "string" || ncfg.url == ""){
        errors.push(net, "url", ncfg.url, "string");
      }

      const netConfigResult = HttpNetworkConfig.decode(ncfg);
      if (isLeft(netConfigResult)) {
        errors.push(net, "", ncfg, "HttpNetworkConfig");
      }
    }
  }

  // io-ts can get confused if there are errors that it can't understand.
  // It will treat networks as an HTTPConfig and may give a loot of errors.
  if (!errors.isEmpty()) {
    return errors;
  }

  const result = Config.decode(config);

  if (isRight(result)) {
    return errors;
  }

  errors.concatenate(DotPathReporter.report(result));
  return errors
}


function validateAlgobChainCfg(ncfg: AlgobChainCfg, errors: CfgErrors) {
  if (
    ncfg.initialDate !== undefined &&
    typeof ncfg.initialDate !== "string"
  )
    errors.push(ALGOB_CHAIN_NAME, "initialDate", ncfg.initialDate, "string | undefined");

  if (
    ncfg.throwOnTransactionFailures !== undefined &&
    typeof ncfg.throwOnTransactionFailures !== "boolean"
  )
    errors.push(ALGOB_CHAIN_NAME, "throwOnTransactionFailures", ncfg.throwOnTransactionFailures, "boolean | undefined");

  if (
    ncfg.throwOnCallFailures !== undefined &&
    typeof ncfg.throwOnCallFailures !== "boolean"
  )
    errors.push(ALGOB_CHAIN_NAME, "throwOnCallFailures", ncfg.throwOnCallFailures, "boolean | undefined");

  if ((ncfg as any).url !== undefined) {
    errors.push(ALGOB_CHAIN_NAME, "url", (ncfg as any).url, "null (forbidden)");
  }

  if (
    ncfg.chainName !== undefined &&
    typeof ncfg.chainName !== "string"
  )
    errors.push(ALGOB_CHAIN_NAME, "chainName", ncfg.chainName, "string | undefined");

  if (
    ncfg.loggingEnabled !== undefined &&
    typeof ncfg.loggingEnabled !== "boolean"
  )
    errors.push(ALGOB_CHAIN_NAME, "loggingEnabled", ncfg.loggingEnabled, "boolean | undefined");
}

export function validateConfigAccount() {
  // TODO
  // if (Array.isArray(ncfg.accounts)) {
}
