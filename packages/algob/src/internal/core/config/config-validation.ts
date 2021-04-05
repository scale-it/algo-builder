import { parseZodError } from "@algo-builder/runtime";
import * as z from 'zod';

import { validateAccount } from "../../../lib/account";
// import { Account } from "algosdk";
import type { ChainCfg, HttpNetworkConfig, NetworkConfig } from "../../../types";
import { ALGOB_CHAIN_NAME } from "../../constants";
import { BuilderError } from "../errors";
import { ERRORS } from "../errors-list";
import CfgErrors from "./config-errors";

const AccountType = z.object({
  addr: z.string(),
  sk: z.unknown(),
  name: z.string()
});

const ChainType = z.object({
  accounts: z.array(AccountType).optional(),
  chainName: z.string().optional(),
  throwOnTransactionFailures: z.boolean().optional(),
  throwOnCallFailures: z.boolean().optional(),
  loggingEnabled: z.boolean().optional(),
  initialDate: z.string().optional()
}).nonstrict();

const HttpHeaders = z.record(z.string());

const KmdAccount = z.object({
  name: z.string(),
  address: z.string()
});

const KmdWallet = z.object({
  name: z.string(),
  password: z.string(),
  accounts: z.array(KmdAccount)
}).nonstrict();

const KmdCfg = z.object({
  host: z.string(),
  port: z.number(),
  token: z.string(),
  wallets: z.array(KmdWallet)
}).nonstrict();

const HttpNetworkType = z.object({
  accounts: z.array(AccountType).optional(),
  chainName: z.string().optional(),
  // from: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  token: z.string().optional(),
  httpHeaders: HttpHeaders.optional(),
  kmdCfg: KmdCfg.optional()
}).nonstrict();

const NetworkType = z.union([ChainType, HttpNetworkType]);

const NetworksType = z.record(NetworkType);

const ProjectPaths = z.object({
  root: z.string().optional(),
  cache: z.string().optional(),
  artifacts: z.string().optional(),
  sources: z.string().optional(),
  tests: z.string().optional()
}).nonstrict(); ;

const Config = z.object({
  networks: NetworksType.optional(),
  paths: ProjectPaths.optional()
}
).nonstrict(); ;

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

  if (config !== undefined && typeof config.networks === "object") {
    for (const [net, ncfg] of Object.entries<NetworkConfig>(config.networks)) {
      const accountsMap = new Map<string, number>(); // {} as ([key: string]: number);
      let j;
      for (let i = 0; i < (ncfg.accounts || []).length; ++i) {
        const a = ncfg.accounts[i];
        const p = errors.putter(net + ".accounts", i.toString());
        validateAccount(a, p);
        if ((j = accountsMap.get(a.name)) !== undefined) { p.push('name', `Account name ${a.name} already exists at index ${j}`, 'string'); } else { accountsMap.set(a.name, i); }
      }

      // ONLY Chain network can be of type ChainCfg
      if (net === ALGOB_CHAIN_NAME) {
        validateChainCfg(ncfg, errors);
        continue;
      }

      const hcfg = ncfg as HttpNetworkConfig;
      const host = hcfg.host;
      if (typeof host !== "string" || host === "" || !validateHostname(host)) {
        errors.push(net, "host", host, "hostname string (eg: http://example.com)");
      }
      const token = hcfg.token;
      if (typeof token !== "string" || token.length < 10) {
        errors.push(net, "token", token, "string");
      }

      try {
        HttpNetworkType.parse(hcfg);
      } catch (e) {
        if (e instanceof z.ZodError) {
          errors.appendErrors([parseZodError(e)]);
        }
      }
    }
  }

  if (!errors.isEmpty()) {
    return errors;
  }

  try {
    Config.parse(config);
  } catch (e) {
    if (e instanceof z.ZodError) {
      errors.appendErrors([parseZodError(e)]);
    }
  }
  return errors;
}

function validateChainCfg (ncfg: ChainCfg, errors: CfgErrors): void {
  const tBoolOpt = "boolean | undefined";
  if (
    ncfg.initialDate !== undefined &&
    typeof ncfg.initialDate !== "string"
  ) { errors.push(ALGOB_CHAIN_NAME, "initialDate", ncfg.initialDate, "string | undefined"); }

  if (
    ncfg.throwOnTransactionFailures !== undefined &&
    typeof ncfg.throwOnTransactionFailures !== "boolean"
  ) { errors.push(ALGOB_CHAIN_NAME, "throwOnTransactionFailures", ncfg.throwOnTransactionFailures, tBoolOpt); }

  if (
    ncfg.throwOnCallFailures !== undefined &&
    typeof ncfg.throwOnCallFailures !== "boolean"
  ) { errors.push(ALGOB_CHAIN_NAME, "throwOnCallFailures", ncfg.throwOnCallFailures, tBoolOpt); }

  const host = (ncfg as HttpNetworkConfig).host;
  if (host !== undefined) {
    errors.push(ALGOB_CHAIN_NAME, "host", host, "null (forbidden)");
  }

  if (
    ncfg.chainName !== undefined &&
    typeof ncfg.chainName !== "string"
  ) { errors.push(ALGOB_CHAIN_NAME, "chainName", ncfg.chainName, "string | undefined"); }

  if (
    ncfg.loggingEnabled !== undefined &&
    typeof ncfg.loggingEnabled !== "boolean"
  ) { errors.push(ALGOB_CHAIN_NAME, "loggingEnabled", ncfg.loggingEnabled, tBoolOpt); }
}

// this comes from https://stackoverflow.com/questions/5717093
const hostPattern = new RegExp('^(https?:\\/\\/)?' + // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
  '(localhost)|' + // localhost
  '((\\d{1,3}\\.){3}\\d{1,3}))'); // OR ip (v4) address

function validateHostname (str: string): boolean {
  return !!hostPattern.test(str);
}
