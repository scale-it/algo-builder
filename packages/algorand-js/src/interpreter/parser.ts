import fs from "fs";
import readline from "readline";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Operator } from "../types";
import { Add, Addr, Div, Int, Mul, Pragma, Sub } from "./opcode-list"; ;

var opCodeMap: {[key: string]: any } = {
  // Pragma
  "#pragma": Pragma,

  // Pseudo-Ops
  addr: Addr,
  int: Int,

  // Arithmetic ops
  "+": Add,
  "-": Sub,
  "/": Div,
  "*": Mul
};

/**
 * Description: Read line and split it into words
 * - ignore comments, keep only part that is relevant to interpreter
 * @param line : Line read from TEAL file
 */
/* eslint-disable sonarjs/cognitive-complexity */
export function wordsFromLine (line: string): string[] {
  // Trim whitespace from both sides of a string
  line = line.trim();
  const words = [] as string[];
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
              words.push(line.substr(start, i - start));
            }
            return words;
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
      words.push(value);
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
    words.push(line.substr(start, i - start));
  }

  return words;
}

/**
 * Description: Returns Opcode object for given field
 * @param words : words extracted from line
 * @param counter: line number in TEAL file
 */
export function opcodeFromSentence (words: string[], counter: number): Operator {
  const opCode = words[0];
  words.shift();

  if (opCodeMap[opCode] === undefined) {
    throw new TealError(ERRORS.TEAL.INVALID_OP_ARG);
  }

  return new opCodeMap[opCode](words, counter);
}

/**
 * Description: Returns a list of Opcodes object after reading text from given TEAL file
 * @param filename : Name of the TEAL file with location
 */
export async function parser (filename: string): Promise<Operator[]> {
  const opCodeList = [] as Operator[];
  let counter = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(filename), // file location
    output: process.stdout,
    terminal: false
  });

  for await (const line of rl) {
    counter++;
    // If line is blank or is comment, continue.
    if (line.length === 0 || line.startsWith("//")) {
      continue;
    }

    // Trim whitespace from line and extract words from line
    const words = wordsFromLine(line);
    if (words.length !== 0) {
      opCodeList.push(opcodeFromSentence(words, counter));
    }
  }
  return opCodeList;
}
