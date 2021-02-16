import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Interpreter } from "../interpreter/interpreter";
import {
  Add, Addr, Addw, And, AppGlobalDel, AppGlobalGet, AppGlobalGetEx,
  AppGlobalPut, AppLocalDel, AppLocalGet, AppLocalGetEx, AppLocalPut,
  AppOptedIn, Arg, Balance, BitwiseAnd, BitwiseNot, BitwiseOr,
  BitwiseXor, Branch, BranchIfNotZero, BranchIfZero, Btoi,
  Byte, Bytec, Bytecblock, Concat, Div, Dup, Dup2, Ed25519verify,
  EqualTo, Err, GetAssetDef, GetAssetHolding, Global, GreaterThan,
  GreaterThanEqualTo, Gtxn, Gtxna, Int, Intc, Intcblock, Itob,
  Keccak256, Label, Len, LessThan, LessThanEqualTo, Load, Mod,
  Mul, Mulw, Not, NotEqualTo, Or, Pop, Pragma, Return, Sha256,
  Sha512_256, Store, Sub, Substring, Substring3, Txn, Txna
} from "../interpreter/opcode-list";
import { LogicSigMaxCost, LogicSigMaxSize, MaxAppProgramCost, MaxAppProgramLen, OpGasCost } from "../lib/constants";
import { assertLen } from "../lib/parsing";
import { ExecutionMode, Operator } from "../types";

// teal v1 opcodes
const opCodeMap: { [key: number]: {[key: string]: any} } = { // tealVersion => opcodeMap
  1: {
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
    pop: Pop,
    dup: Dup,

    // Pseudo-Ops
    addr: Addr,
    int: Int,
    byte: Byte,

    // Branch Opcodes
    bnz: BranchIfNotZero,

    // Transaction Opcodes
    txn: Txn,
    gtxn: Gtxn,
    global: Global
  }
};

// teal v2 opcodes
opCodeMap[2] = {
  ...opCodeMap[1], // includes all v1 opcodes

  addw: Addw,

  // txn ops
  txna: Txna,
  gtxna: Gtxna,

  // branch opcodes in v2
  b: Branch,
  bz: BranchIfZero,
  return: Return,

  dup2: Dup2,
  concat: Concat,
  substring: Substring,
  substring3: Substring3,

  // Stateful Opcodes
  app_opted_in: AppOptedIn,
  app_local_get: AppLocalGet,
  app_local_get_ex: AppLocalGetEx,
  app_global_get: AppGlobalGet,
  app_global_get_ex: AppGlobalGetEx,
  app_local_put: AppLocalPut,
  app_global_put: AppGlobalPut,
  app_local_del: AppLocalDel,
  app_global_del: AppGlobalDel,

  balance: Balance,
  asset_holding_get: GetAssetHolding,
  asset_params_get: GetAssetDef
};

// list of opcodes that require one extra parameter than others: `interpreter`.
const interpreterReqList = new Set([
  "#pragma", "arg", "bytecblock", "bytec", "intcblock", "intc", "store",
  "load", "b", "bz", "bnz", "return", "txn", "gtxn", "txna", "gtxna", "global",
  "balance", "asset_holding_get", "asset_params_get", "app_opted_in",
  "app_local_get", "app_local_get_ex", "app_global_get", "app_global_get_ex",
  "app_local_put", "app_global_put", "app_local_del", "app_global_del"
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
 * NOTE: we are also calculating the gas cost associated with each opcode,
 * and throwing error if the total gas of TEAL code exceeds the max gas cost for
 * respective execution modes
 * @param words : words extracted from line
 * @param counter: line number in TEAL file
 * @param interpreter: interpreter object
 */
export function opcodeFromSentence (words: string[], counter: number, interpreter: Interpreter): Operator {
  let opCode = words[0];
  const tealVersion = interpreter.tealVersion;

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
    if (opCodeMap[tealVersion][opCode.slice(0, opCode.length - 1)] !== undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_LABEL, { line: counter }); // eg. `int:` is invalid label as `int` is an opcode
    }
    return new Label([opCode], counter);
  }

  if (opCodeMap[tealVersion][opCode] === undefined) {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKOWN_OPCODE,
      { opcode: opCode, version: tealVersion, line: counter });
  }

  // increment gas of TEAL code
  // Add 1 if opCode is not present in OpGasCost map
  if (opCode !== '#pragma') { interpreter.gas += OpGasCost[tealVersion][opCode] ?? 1; }

  if (interpreterReqList.has(opCode)) {
    return new opCodeMap[tealVersion][opCode](words, counter, interpreter);
  }
  return new opCodeMap[tealVersion][opCode](words, counter);
}

// verify max cost of TEAL code is within consensus parameters
function assertMaxCost (gas: number, mode: ExecutionMode): void {
  if (mode === ExecutionMode.STATELESS) {
    // check max cost (for stateless)
    if (gas > LogicSigMaxCost) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED, {
        cost: gas,
        maxcost: LogicSigMaxCost,
        mode: 'Stateless'
      });
    }
  } else {
    if (gas > MaxAppProgramCost) {
      // check max cost (for stateful)
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_COST_EXCEEDED, {
        cost: gas,
        maxcost: MaxAppProgramCost,
        mode: 'Stateful'
      });
    }
  }
}

// verify max length of TEAL code is within consensus parameters
function assertMaxLen (len: number, mode: ExecutionMode): void {
  if (mode === ExecutionMode.STATELESS) {
    // check max program cost (for stateless)
    if (len > LogicSigMaxSize) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED, {
        length: len,
        maxlen: LogicSigMaxSize,
        mode: 'Stateless'
      });
    }
  } else {
    if (len > MaxAppProgramLen) {
      // check max program length (for stateful)
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.MAX_LEN_EXCEEDED, {
        length: len,
        maxlen: MaxAppProgramLen,
        mode: 'Stateful'
      });
    }
  }
}

/**
 * Description: Returns a list of Opcodes object after reading text from given TEAL file
 * @param program : TEAL code as string
 * @param mode : execution mode of TEAL code (Stateless or Application)
 * @param interpreter: interpreter object
 */
export function parser (program: string, mode: ExecutionMode, interpreter: Interpreter): Operator[] {
  const opCodeList = [] as Operator[];
  let counter = 0;

  const lines = program.split('\n');
  for (const line of lines) {
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

  assertMaxCost(interpreter.gas, mode);
  // TODO: check if we can calculate length in: https://www.pivotaltracker.com/story/show/176623588
  // assertMaxLen(interpreter.length, mode);
  return opCodeList;
}
