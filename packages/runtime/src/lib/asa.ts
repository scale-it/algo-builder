import path from "path";
import * as z from 'zod';

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { parseZodError } from "../errors/validation-errors";
import { AccountMap, ASADef, ASADefs, RuntimeAccountMap } from "../types";
import { ASADefsSchema } from "../types-input";
import { loadFromYamlFileSilentWithMessage } from "./files";

const ASSETS_DIR = "assets";
/**
 * Validates asset definitions and checks if opt-in acc names are present in network
 * @param accounts AccountMap is the SDK account type, used in builder. RuntimeAccountMap is
 * for StoreAccount used in runtime (where we use maps instead of arrays in sdk structures).
 * @param filename asa filename
 * @param asaDef asset definitions
 */
function validateSingle (accounts: AccountMap | RuntimeAccountMap, filename: string, asaDef: ASADef): void {
  if (!asaDef.optInAccNames || asaDef.optInAccNames.length === 0) {
    return;
  }
  for (const accName of asaDef.optInAccNames) {
    if (!accounts.get(accName)) {
      throw new RuntimeError(
        RUNTIME_ERRORS.ASA.PARAM_ERROR_NO_NAMED_OPT_IN_ACCOUNT, {
          filename: filename,
          optInAccName: accName
        });
    }
  }
}

function validateParsedASADefs (
  accounts: AccountMap | RuntimeAccountMap, asaDefs: ASADefs, filename: string): void {
  for (const def of Object.values(asaDefs)) {
    def.manager = def.manager !== "" ? def.manager : undefined;
    def.reserve = def.reserve !== "" ? def.reserve : undefined;
    def.freeze = def.freeze !== "" ? def.freeze : undefined;
    def.clawback = def.clawback !== "" ? def.clawback : undefined;
    validateSingle(accounts, filename, def);
  }
}

export function validateASADefs (
  obj: Object, accounts: AccountMap | RuntimeAccountMap, filename: string): ASADefs {
  try {
    const parsed = ASADefsSchema.parse(obj);
    Object.keys(parsed).forEach(k => {
      if (parsed[k].defaultFrozen === undefined) {
        parsed[k].defaultFrozen = false;
      }
    });
    validateParsedASADefs(accounts, parsed, filename);
    return parsed;
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new RuntimeError(
        RUNTIME_ERRORS.ASA.PARAM_PARSE_ERROR, {
          reason: parseZodError(e),
          filename: filename
        }, e);
    }
    throw e;
  }
}

export function loadASAFile (accounts: AccountMap | RuntimeAccountMap): ASADefs {
  const filename = path.join(ASSETS_DIR, "asa.yaml");
  return validateASADefs(
    loadFromYamlFileSilentWithMessage(filename, "ASA file not defined"),
    accounts,
    filename);
}
