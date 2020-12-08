import { isValidAddress } from "algosdk";
import fs from "fs";
import readline from "readline";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { ARITHMETIC_OPERATIONS, PSEUDO_OPS } from "../lib/constants";
import { assertFieldLen, assertOnlyDigits } from "../lib/helpers";
import { Operator } from "../types";
import { Add, Addr, Div, Int, Mul, Sub } from "./opcode-list";

/**
 * Description: Read line and split it into fields
 * - ignore comments, keep only part that is relevant to interpreter
 * @param line : Line read from TEAL file
 */
/* eslint-disable sonarjs/cognitive-complexity */
export function fieldsFromLine (line: string): string[] {
  // Trim whitespace from both sides of a string
  line = line.trim();
  const fields = [] as string[];
  let i = 0;
  let start = i;
  let inString = false;
  let inBase64 = false;
  while (i < line.length) {
    // check if not space
    if (line[i] !== ' ') {
      switch (line[i]) {
        // check for string literal
        case '"':
          if (!inString) {
            if ((i === 0) || (i > 0 && line[i - 1] === ' ')) {
              inString = true;
            }
          } else {
            // if not escape symbol
            if (line[i - 1] !== '\\') {
              inString = false;
            }
          }
          break;
        // is a comment?
        case '/':
          if (i < line.length - 1 && line[i + 1] === '/' && !inBase64 && !inString) {
            // if a comment without whitespace
            if (start !== i) {
              fields.push(line.substr(start, i - start));
            }
            return fields;
          }
          break;
        // is base64( seq?
        case '(':
          var prefix = line.substr(start, i - start);
          if (prefix === "base64" || prefix === "b64") {
            inBase64 = true;
          }
          break;
        // is ) as base64( completion
        case ')':
          if (inBase64) {
            inBase64 = false;
          }
          break;
        default:
          break;
      }
      i++;
      continue;
    }
    if (!inString) {
      const value = line.substr(start, i - start);
      fields.push(value);
      if (value === "base64" || value === "b64") {
        inBase64 = true;
      } else if (inBase64) {
        inBase64 = false;
      }
    }
    i++;

    if (!inString) {
      while (i < line.length && line[i] === ' ') {
        i++;
      }
      start = i;
    }
  }

  // add rest of the string if any
  if (start < line.length) {
    fields.push(line.substr(start, i - start));
  }

  return fields;
}

/**
 * Description: Returns Opcode objects for fields with Pseudo-Ops
 * @param fields : fields with field[0] as one of the Pseudo-Ops
 */
export function pseudoOps (fields: string[]): Operator {
  switch (fields[0]) {
    case "addr":
      assertFieldLen(fields.length, 2);
      if (!isValidAddress(fields[1])) {
        throw new TealError(ERRORS.TEAL.INVALID_ADDR);
      }

      return new Addr(fields[1]);
    case "int":
      // allowed fields int 123 only. (int(12) is not allowed)
      assertFieldLen(fields.length, 2);
      assertOnlyDigits(fields[1]);

      return new Int(BigInt(fields[1]));
    default:
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG);
  }
}

/**
 * Description: Returns Opcode objects for fields with Arithmetic-Opcodes
 * @param fields : fields with field[0] as one of the Arithmetic-Opcodes
 */
export function arithmeticOps (fields: string[]): Operator {
  assertFieldLen(fields.length, 1);

  switch (fields[0]) {
    case "+":
      return new Add();
    case "-":
      return new Sub();
    case "/":
      return new Div();
    case "*":
      return new Mul();
    default:
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG);
  }
}

/**
 * Description: Returns Opcode object for given field
 * @param fields : fields extracted from line
 */
export function opcodeFromFields (fields: string[]): Operator {
  if (PSEUDO_OPS.includes(fields[0])) {
    return pseudoOps(fields);
  } else if (ARITHMETIC_OPERATIONS.includes(fields[0])) {
    return arithmeticOps(fields);
  } else {
    throw new TealError(ERRORS.TEAL.INVALID_OP_ARG);
  }
}

/**
 * Description: Returns a list of Opcodes object after reading text from given TEAL file
 * @param filename : Name of the TEAL file which must be present in ?????
 */
export function parser (filename: string): Operator[] {
  const opCodeList = [] as Operator[];
  const rl = readline.createInterface({
    input: fs.createReadStream('filename'), // file location
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    // console.log(line);
    if (!(line.length === 0 || line.startsWith("//") || line.startsWith("#pragma"))) {
      const fields = fieldsFromLine(line);

      if (fields.length !== 0) {
        opCodeList.push(opcodeFromFields(fields));
      }
    }
  });

  return opCodeList;
}
