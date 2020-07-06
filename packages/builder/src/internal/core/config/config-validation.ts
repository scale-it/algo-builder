import { fold, isLeft,isRight } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/pipeable";
import * as t from "io-ts";
import { Context, ValidationError } from "io-ts/lib";
import { Reporter } from "io-ts/lib/Reporter";

import type { AlgobChainCfg, HttpNetworkConfig, NetworkConfig } from "../../../types";
import { ALGOB_CHAIN_NAME } from "../../constants";
import { BuilderError } from "../errors";
import { ERRORS } from "../errors-list";
import CfgErrors, {mkErrorMessage} from "./config-errors";

function getContextPath(context: Context): string {
  const keysPath = context
    .slice(1)
    .map((c) => c.key)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: (validation: any) => pipe(validation, fold(failure, success)) ,
};

function optional<TypeT, OutputT>(
  codec: t.Type<TypeT, OutputT, unknown>,
  name = `${codec.name} | undefined`
): t.Type<TypeT | undefined, OutputT | undefined, unknown> {
  return new t.Type(
    name,
    (u: unknown): u is TypeT | undefined => u === undefined || codec.is(u),
    (u: any, c: any) => (u === undefined ? t.success(u) : codec.validate(u, c)), // eslint-disable-line @typescript-eslint/no-explicit-any
    (a: any) => (a === undefined ? undefined : codec.encode(a))  // eslint-disable-line @typescript-eslint/no-explicit-any
  );
}

// IMPORTANT: This t.types MUST be kept in sync with the actual types.

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

const AlgobChainType = t.type({
  // accounts: optional(t.array(todo)),
  chainName: optional(t.string),
  throwOnTransactionFailures: optional(t.boolean),
  throwOnCallFailures: optional(t.boolean),
  loggingEnabled: optional(t.boolean),
  initialDate: optional(t.string),
});

const HttpHeaders = t.record(t.string, t.string, "httpHeaders");

const HttpNetworkType = t.type({
  accounts: optional(NetworkAccounts),
  chainName: optional(t.string),
  // from: optional(t.string),
  host: optional(t.string),
  port: optional(t.number),
  token: optional(t.string),
  httpHeaders: optional(HttpHeaders),
});

const NetworkType = t.union([AlgobChainType, HttpNetworkType]);

const NetworksType = t.record(t.string, NetworkType);

const ProjectPaths = t.type({
  root: optional(t.string),
  cache: optional(t.string),
  artifacts: optional(t.string),
  sources: optional(t.string),
  tests: optional(t.string),
});


const Config = t.type(
  {
    networks: optional(NetworksType),
    paths: optional(ProjectPaths),
  },
  "AlgobConfig"
);

/**
 * Validates the config, throwing a BuilderError if invalid.
 * @param config
 */
export function validateConfig(config: any) { // eslint-disable-line
  const errors = getValidationErrors(config);

  if (errors.isEmpty()) {
    return;
  }

  const errorList = `  * ${errors.toString()}`;
  throw new BuilderError(ERRORS.GENERAL.INVALID_CONFIG, { errors: errorList });
}

export function getValidationErrors(config: any): CfgErrors {  // eslint-disable-line
  const errors = new CfgErrors();

  // These can't be validated with io-ts
  if (config !== undefined && typeof config.networks === "object") {
    for (const [net, ncfg] of Object.entries<NetworkConfig>(config.networks)) {
      if (net === ALGOB_CHAIN_NAME) {
        validateAlgobChainCfg(ncfg, errors);
        continue;
      }
      // ONLY AlgobChain network can be of type AlgobChainCfg
      const hcfg = ncfg as HttpNetworkConfig;
      const host = hcfg.host;
      if (typeof host !== "string" || host == "" || !validateHostname(host)){
        errors.push(net, "host", host, "hostname string (eg: http://example.com)");
      }
      const token = hcfg.token;
      if (typeof token !== "string" || token.length < 10){
        errors.push(net, "token", token, "string");
      }

      const netConfigResult = HttpNetworkType.decode(hcfg);
      if (isLeft(netConfigResult)) {
        errors.push(net, "", hcfg, "HttpNetworkConfig");
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
  const tBoolOpt = "boolean | undefined";
  if (
    ncfg.initialDate !== undefined &&
    typeof ncfg.initialDate !== "string"
  )
    errors.push(ALGOB_CHAIN_NAME, "initialDate", ncfg.initialDate, "string | undefined");

  if (
    ncfg.throwOnTransactionFailures !== undefined &&
    typeof ncfg.throwOnTransactionFailures !== "boolean"
  )
    errors.push(ALGOB_CHAIN_NAME, "throwOnTransactionFailures", ncfg.throwOnTransactionFailures, tBoolOpt);

  if (
    ncfg.throwOnCallFailures !== undefined &&
    typeof ncfg.throwOnCallFailures !== "boolean"
  )
    errors.push(ALGOB_CHAIN_NAME, "throwOnCallFailures", ncfg.throwOnCallFailures, tBoolOpt);

  const host = (ncfg as HttpNetworkConfig).host
  if (host !== undefined) {
    errors.push(ALGOB_CHAIN_NAME, "host", host, "null (forbidden)");
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
    errors.push(ALGOB_CHAIN_NAME, "loggingEnabled", ncfg.loggingEnabled, tBoolOpt);
}

export function validateConfigAccount() : void{
  // TODO
  // if (Array.isArray(ncfg.accounts)) {
}


// this comes from https://stackoverflow.com/questions/5717093
const hostPattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
  '(localhost)|'+ // localhost
  '((\\d{1,3}\\.){3}\\d{1,3}))'); // OR ip (v4) address

function validateHostname(str: string): boolean {
  return !!hostPattern.test(str);
}
