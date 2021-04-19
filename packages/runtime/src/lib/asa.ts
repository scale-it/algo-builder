import path from "path";
import * as z from 'zod';

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { parseZodError } from "../errors/validation-errors";
import { AccountMap, ASADef, ASADefs, RuntimeAccountMap } from "../types";
import { ASADefSchema } from "../types-input";
import { loadFromYamlFileSilentWithMessage } from "./files";

const ASSETS_DIR = "assets";
/**
 * Validates asset definitions and checks if opt-in acc names are present in network
 * @param accounts AccountMap is the SDK account type, used in builder. RuntimeAccountMap is
 * for AccountStore used in runtime (where we use maps instead of arrays in sdk structures).
 * @param filename asa filename
 * @param asaDef asset definition
 */
function validateOptInAccNames (accounts: AccountMap | RuntimeAccountMap,
  asaDef: ASADef,
  source?: string): void {
  if (!asaDef.optInAccNames || asaDef.optInAccNames.length === 0) {
    return;
  }
  for (const accName of asaDef.optInAccNames) {
    if (!accounts.get(accName)) {
      throw new RuntimeError(
        RUNTIME_ERRORS.ASA.PARAM_ERROR_NO_NAMED_OPT_IN_ACCOUNT, {
          source: source,
          optInAccName: accName
        });
    }
  }
}

/**
 * Validate and parse each field of asset definition
 * @param asaDef asset definition
 * @param source source of assetDef: asa.yaml file OR function deployASA
 * @returns parsed asa definition
 */
function _parseASADef (asaDef: ASADef, source?: string): ASADef {
  try {
    const parsedDef = ASADefSchema.parse(asaDef);
    parsedDef.manager = parsedDef.manager !== "" ? parsedDef.manager : undefined;
    parsedDef.reserve = parsedDef.reserve !== "" ? parsedDef.reserve : undefined;
    parsedDef.freeze = parsedDef.freeze !== "" ? parsedDef.freeze : undefined;
    parsedDef.clawback = parsedDef.clawback !== "" ? parsedDef.clawback : undefined;
    parsedDef.defaultFrozen = parsedDef.defaultFrozen ?? false;
    return parsedDef;
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new RuntimeError(
        RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR, {
          reason: parseZodError(e),
          source: source
        }, e);
    }
    throw e;
  }
}

/**
 * Override & validate ASA definition in asa.yaml using custom params passed via deployASA
 * @param accounts accounts by name
 * @param origDef source asset definition (in asa.yaml)
 * @param newDef custom asset def params (passed during ASA deployment)
 * @returns overriden asset definition. If custom params are empty, return source asa def
 */
export function overrideASADef (
  accounts: AccountMap,
  origDef: ASADef,
  newDef?: Partial<ASADef>): ASADef {
  if (newDef === undefined) { return origDef; }

  const source = 'ASA deployment';
  Object.assign(origDef, newDef);
  origDef = _parseASADef(origDef, source);
  validateOptInAccNames(accounts, origDef, source);
  return origDef;
}

export function validateASADefs (
  asaDefs: ASADefs, accounts: AccountMap | RuntimeAccountMap, filename: string): ASADefs {
  for (const name in asaDefs) {
    asaDefs[name] = _parseASADef(asaDefs[name], filename);
    validateOptInAccNames(accounts, asaDefs[name], filename);
  }
  return asaDefs;
}

export function loadASAFile (accounts: AccountMap | RuntimeAccountMap): ASADefs {
  const filename = path.join(ASSETS_DIR, "asa.yaml");
  return validateASADefs(
    loadFromYamlFileSilentWithMessage(filename, "ASA file not defined"),
    accounts,
    filename);
}
