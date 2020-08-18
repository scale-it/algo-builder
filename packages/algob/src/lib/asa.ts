import fs from "fs";
import * as z from 'zod';

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { parseZodError } from "../internal/core/validation-errors";
import { ASADef } from "../types";
import { ASADefSchema } from "../types-input";

export function parseASADef (obj: Object, filename: string): ASADef {
  try {
    const parsed = ASADefSchema.parse(obj);
    if (parsed.defaultFrozen === undefined) {
      parsed.defaultFrozen = false;
    }
    return parsed;
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new BuilderError(ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR, {
        reason: parseZodError(e),
        filename: filename
      }, e);
    }
    throw e;
  }
}

export function loadASAFile (filename: string): ASADef {
  return parseASADef(fs.readFileSync(filename), filename);
}
