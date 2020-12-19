import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Interpreter } from "../interpreter/interpreter";
import {
  Add, Addr, Addw, And, Arg, BitwiseAnd, BitwiseNot, BitwiseOr, BitwiseXor,
  Branch, BranchIfNotZero, BranchIfZero, Btoi, Byte, Bytec, Bytecblock,
  Concat, Div, Dup, Dup2, Ed25519verify, EqualTo, Err, GreaterThan,
  GreaterThanEqualTo, Gtxn, Gtxna, Int, Intc, Intcblock, Itob, Keccak256, Label,
  Len, LessThan, LessThanEqualTo, Load, Mod, Mul, Mulw, Not, NotEqualTo, Or,
  Pop, Pragma, Return, Sha256, Sha512_256, Store, Sub, Substring, Substring3, Txn, Txna
} from "../interpreter/opcode-list";
import { assertLen } from "../lib/parsing";
import { Operator } from "../types";

var opCodeMap: {[key: string]: any } = {
  // Pragma
  "#pragma": Pragma,

  len: Len,
  err: Err,

  // Arithmetic ops
  "+": Add,
  "-": Sub,
  "/": Div,
  "*": Mul,

  arg: Arg,
  bytecblock: Bytecblock,
  bytec: Bytec,
  intcblock: Intcblock,
  intc: Intc,

  "%": Mod,
  "|": BitwiseOr,
  "&": BitwiseAnd,
  "^": BitwiseXor,
  "~": BitwiseNot,

  store: Store,
  load: Load,

  // crypto opcodes
  sha256: Sha256,
  sha512_256: Sha512_256,
  keccak256: Keccak256,
  ed25519verify: Ed25519verify,

  "<": LessThan,
  ">": GreaterThan,
  "<=": LessThanEqualTo,
  ">=": GreaterThanEqualTo,
  "&&": And,
  "||": Or,
  "==": EqualTo,
  "!=": NotEqualTo,
  "!": Not,

  itob: Itob,
  btoi: Btoi,
  mulw: Mulw,
  addw: Addw,
  pop: Pop,
  dup: Dup,
  dup2: Dup2,
  concat: Concat,
  substring: Substring,
  substring3: Substring3,

  // Pseudo-Ops
  addr: Addr,
  int: Int,
  byte: Byte,

  // Branch Opcodes
  b: Branch,
  bz: BranchIfZero,
  bnz: BranchIfNotZero,

  return: Return,

  // Transaction Opcodes
  txn: Txn,
  gtxn: Gtxn,
  txna: Txna,
  gtxna: Gtxna
};

// list of opcodes that require one extra parameter than others: `interpreter`.
const interpreterReqList = new Set([
  "arg", "bytecblock", "bytec", "intcblock", "intc", "store", "load",
  "b", "bz", "bnz", "return", "txn", "gtxn", "txna", "gtxna"
]);

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
 * @param interpreter: interpreter object
 */
export function opcodeFromSentence (words: string[], counter: number, interpreter: Interpreter): Operator {
  let opCode = words[0];

  // arg
  if (opCode.startsWith("arg_")) {
    assertLen(words.length, 1, counter);
    words = [];
    words.push("arg_");
    words.push(opCode.slice(4));
    opCode = "arg";
  }
  // intc
  if (opCode.startsWith("intc_")) {
    assertLen(words.length, 1, counter);
    words = [];
    words.push("intc_");
    words.push(opCode.slice(5));
    opCode = "intc";
  }
  // bytec
  if (opCode.startsWith("bytec_")) {
    assertLen(words.length, 1, counter);
    words = [];
    words.push("bytec_");
    words.push(opCode.slice(6));
    opCode = "bytec";
  }

  words.shift();

  // Handle Label
  if (opCode.endsWith(':')) {
    assertLen(words.length, 0, counter);
    if (opCodeMap[opCode.slice(0, opCode.length - 1)] !== undefined) {
      throw new TealError(ERRORS.TEAL.INVALID_LABEL);
    }
    return new Label([opCode], counter);
  }

  if (opCodeMap[opCode] === undefined) {
    throw new TealError(ERRORS.TEAL.INVALID_OP_ARG);
  }

  if (interpreterReqList.has(opCode)) {
    return new opCodeMap[opCode](words, counter, interpreter);
  }
  return new opCodeMap[opCode](words, counter);
}

/**
 * Description: Returns a list of Opcodes object after reading text from given TEAL file
 * @param program : TEAL code as string
 * @param interpreter: interpreter object
 */
export async function parser (program: string, interpreter: Interpreter): Promise<Operator[]> {
  const opCodeList = [] as Operator[];
  let counter = 0;

  const lines = program.split('\n');
  for await (const line of lines) {
    counter++;
    // If line is blank or is comment, continue.
    if (line.length === 0 || line.startsWith("//")) {
      continue;
    }

    // Trim whitespace from line and extract words from line
    const words = wordsFromLine(line);
    if (words.length !== 0) {
      opCodeList.push(opcodeFromSentence(words, counter, interpreter));
    }
  }
  return opCodeList;
}
