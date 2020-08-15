// import fs from "fs";
import * as z from 'zod';

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import { ASADescription } from "../types";
import { ASADescriptionSchema } from "../types-validated";

export function loadASAFile (filename: string): any {
  // fs.readFileSync()
}

export function parseASADef (obj: Object, filename: string): ASADescription {
  try {
    const parsed = ASADescriptionSchema.parse(obj);
    if (parsed.defaultFrozen === undefined) {
      parsed.defaultFrozen = false;
    }
    return parsed;
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new BuilderError(ERRORS.SCRIPT.ASA_PARAM_PARSE_ERROR, {
        reason: e.toString(), // eslint-disable-line @typescript-eslint/no-base-to-string
        filename: filename
      }, e);
    }
    throw e;
  }
}
