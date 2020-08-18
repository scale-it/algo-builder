import * as z from 'zod';
import path from "path";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { parseZodError } from "../internal/core/validation-errors";
import { ASADef, ASADefs } from "../types";
import { ASADefsSchema } from "../types-input";
import { scriptsDirectory } from "./script-checkpoints";
import { loadFromYamlFile } from "./files";

export function validateASADefs (obj: Object, filename?: string): ASADefs {
  try {
    const parsed = ASADefsSchema.parse(obj);
    Object.keys(parsed).forEach(k => {
      if (parsed[k].defaultFrozen === undefined) {
        parsed[k].defaultFrozen = false;
      }
    })
    return parsed;
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new BuilderError(
        filename
          ? ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR_LOAD_FROM_FILE
          : ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR, {
            reason: parseZodError(e),
            filename: filename
          }, e);
    }
    throw e;
  }
}

export function loadASAFile (): ASADefs {
  const filename = path.join(scriptsDirectory, "asa.yaml");
  return validateASADefs(
    loadFromYamlFile(filename),
    filename)
}
