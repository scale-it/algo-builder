/* eslint sonarjs/no-identical-functions: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */
import { parsing } from "@algo-builder/web";
import algosdk, { ALGORAND_MIN_TX_FEE, decodeAddress, decodeUint64, encodeAddress, encodeUint64, getApplicationAddress, isValidAddress, modelsv2, verifyBytes } from "algosdk";
import { ec as EC } from "elliptic";
import { Message, sha256 } from "js-sha256";
import { sha512_256 } from "js-sha512";
import { Keccak } from 'sha3';

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { compareArray } from "../lib/compare";
import {
  ALGORAND_MAX_LOGS_COUNT, ALGORAND_MAX_LOGS_LENGTH,
  AppParamDefined,
  AssetParamMap, GlobalFields, MathOp,
  MAX_CONCAT_SIZE, MAX_INNER_TRANSACTIONS,
  MAX_INPUT_BYTE_LEN, MAX_OUTPUT_BYTE_LEN,
  MAX_UINT64, MAX_UINT128,
  MaxTEALVersion, TxArrFields, ZERO_ADDRESS
} from "../lib/constants";
import { parseEncodedTxnToExecParams, setInnerTxField } from "../lib/itxn";
import {
  assertLen, assertNumber, assertOnlyDigits, bigEndianBytesToBigInt, bigintToBigEndianBytes, convertToBuffer,
  convertToString, getEncoding, parseBinaryStrToBigInt
} from "../lib/parsing";
import { Stack } from "../lib/stack";
import { txAppArg, txnSpecbyField } from "../lib/txn";
import { DecodingMode, EncodingType, StackElem, TEALStack, TxnType, TxOnComplete, TxReceipt } from "../types";
import { Interpreter } from "./interpreter";
import { Op } from "./opcode";

// Opcodes reference link: https://developer.algorand.org/docs/reference/teal/opcodes/

// Store TEAL version
// push to stack [...stack]
export class Pragma extends Op {
  readonly version: number;
  readonly line: number;
  /**
   * Store Pragma version
   * @param args Expected arguments: ["version", version number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 2, line);
    if (this.line > 1) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.PRAGMA_NOT_AT_FIRST_LINE, { line: line });
    }
    if (args[0] === "version" && Number(args[1]) <= MaxTEALVersion) {
      this.version = Number(args[1]);
      interpreter.tealVersion = this.version;
    } else {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.PRAGMA_VERSION_ERROR, {
        expected: 'till #4',
        got: args.join(' '),
        line: line
      });
    }
  }

  // Returns Pragma version
  getVersion (): number {
    return this.version;
  }

  execute (stack: TEALStack): void { }
}

// pops string([]byte) from stack and pushes it's length to stack
// push to stack [...stack, bigint]
export class Len extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const last = this.assertBytes(stack.pop(), this.line);
    stack.push(BigInt(last.length));
  }
}

// pops two unit64 from stack(last, prev) and pushes their sum(last + prev) to stack
// panics on overflow (result > max_unit64)
// push to stack [...stack, bigint]
export class Add extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    const result = prev + last;
    this.checkOverflow(result, this.line, MAX_UINT64);
    stack.push(result);
  }
}

// pops two unit64 from stack(last, prev) and pushes their diff(last - prev) to stack
// panics on underflow (result < 0)
// push to stack [...stack, bigint]
export class Sub extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    const result = prev - last;
    this.checkUnderflow(result, this.line);
    stack.push(result);
  }
}

// pops two unit64 from stack(last, prev) and pushes their division(last / prev) to stack
// panics if prev == 0
// push to stack [...stack, bigint]
export class Div extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (last === 0n) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
    }
    stack.push(prev / last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their mult(last * prev) to stack
// panics on overflow (result > max_unit64)
// push to stack [...stack, bigint]
export class Mul extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    const result = prev * last;
    this.checkOverflow(result, this.line, MAX_UINT64);
    stack.push(result);
  }
}

// pushes argument[N] from argument array to stack
// push to stack [...stack, bytes]
export class Arg extends Op {
  index: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Gets the argument value from interpreter.args array.
   * store the value in _arg variable
   * @param args Expected arguments: [argument number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    assertOnlyDigits(args[0], this.line);

    this.index = Number(args[0]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(
      this.index, this.interpreter.runtime.ctx.args, this.line);
    const argN = this.assertBytes(this.interpreter.runtime.ctx.args?.[this.index], this.line);
    stack.push(argN);
  }
}

// load block of byte-array constants
// push to stack [...stack]
export class Bytecblock extends Op {
  readonly bytecblock: Uint8Array[];
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Store blocks of bytes in bytecblock
   * @param args Expected arguments: [bytecblock] // Ex: ["value1" "value2"]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    const bytecblock: Uint8Array[] = [];
    for (const val of args) {
      bytecblock.push(parsing.stringToBytes(val));
    }

    this.interpreter = interpreter;
    this.bytecblock = bytecblock;
  }

  execute (stack: TEALStack): void {
    this.assertArrLength(this.bytecblock, this.line);
    this.interpreter.bytecblock = this.bytecblock;
  }
}

// push bytes constant from bytecblock to stack by index
// push to stack [...stack, bytes]
export class Bytec extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets index according to arguments passed
   * @param args Expected arguments: [byteblock index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);

    this.index = Number(args[0]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.bytecblock, this.line);
    const bytec = this.assertBytes(this.interpreter.bytecblock[this.index], this.line);
    stack.push(bytec);
  }
}

// load block of uint64 constants
// push to stack [...stack]
export class Intcblock extends Op {
  readonly intcblock: Array<bigint>;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores block of integer in intcblock
   * @param args Expected arguments: [integer block] // Ex: [100 200]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    const intcblock: Array<bigint> = [];
    for (const val of args) {
      assertOnlyDigits(val, this.line);
      intcblock.push(BigInt(val));
    }

    this.interpreter = interpreter;
    this.intcblock = intcblock;
  }

  execute (stack: TEALStack): void {
    this.assertArrLength(this.intcblock, this.line);
    this.interpreter.intcblock = this.intcblock;
  }
}

// push value from uint64 intcblock to stack by index
// push to stack [...stack, bigint]
export class Intc extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets index according to arguments passed
   * @param args Expected arguments: [intcblock index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);

    this.index = Number(args[0]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.intcblock, this.line);
    const intc = this.assertBigInt(this.interpreter.intcblock[this.index], this.line);
    stack.push(intc);
  }
}

// pops two unit64 from stack(last, prev) and pushes their modulo(last % prev) to stack
// Panic if B == 0.
// push to stack [...stack, bigint]
export class Mod extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (last === 0n) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
    }
    stack.push(prev % last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-or(last | prev) to stack
// push to stack [...stack, bigint]
export class BitwiseOr extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    stack.push(prev | last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-and(last & prev) to stack
// push to stack[...stack, bigint]
export class BitwiseAnd extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    stack.push(prev & last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-xor(last ^ prev) to stack
// push to stack [...stack, bigint]
export class BitwiseXor extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    stack.push(prev ^ last);
  }
}

// pop unit64 from stack and push it's bitwise-invert(~last) to stack
// push to stack [...stack, bigint]
export class BitwiseNot extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    stack.push(~last);
  }
}

// pop last value from the stack and store to scratch space
// push to stack [...stack]
export class Store extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores index number according to arguments passed
   * @param args Expected arguments: [index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 1, this.line);
    assertOnlyDigits(args[0], this.line);

    this.index = Number(args[0]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.scratch, this.line);
    this.assertMinStackLen(stack, 1, this.line);
    const top = stack.pop();
    this.interpreter.scratch[this.index] = top;
  }
}

// copy ith value from scratch space to the stack
// push to stack [...stack, bigint/bytes]
export class Load extends Op {
  index: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores index number according to arguments passed.
   * @param args Expected arguments: [index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 1, this.line);
    assertOnlyDigits(args[0], this.line);

    this.index = Number(args[0]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.scratch, this.line);
    stack.push(this.interpreter.scratch[this.index]);
  }
}

// err opcode : Error. Panic immediately.
// push to stack [...stack]
export class Err extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    throw new RuntimeError(RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR, { line: this.line });
  }
}

// SHA256 hash of value X, yields [32]byte
// push to stack [...stack, bytes]
export class Sha256 extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const hash = sha256.create();
    const val = this.assertBytes(stack.pop(), this.line) as Message;
    hash.update(val);
    const hashedOutput = Buffer.from(hash.hex(), 'hex');
    const arrByte = Uint8Array.from(hashedOutput);
    stack.push(arrByte);
  }
}

// SHA512_256 hash of value X, yields [32]byte
// push to stack [...stack, bytes]
export class Sha512_256 extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const hash = sha512_256.create();
    const val = this.assertBytes(stack.pop(), this.line) as Message;
    hash.update(val);
    const hashedOutput = Buffer.from(hash.hex(), 'hex');
    const arrByte = Uint8Array.from(hashedOutput);
    stack.push(arrByte);
  }
}

// Keccak256 hash of value X, yields [32]byte
// https://github.com/phusion/node-sha3#example-2
// push to stack [...stack, bytes]
export class Keccak256 extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const top = this.assertBytes(stack.pop(), this.line);

    const hash = new Keccak(256);
    hash.update(convertToString(top));
    const arrByte = Uint8Array.from(hash.digest());
    stack.push(arrByte);
  }
}

// for (data A, signature B, pubkey C) verify the signature of
// ("ProgData" || program_hash || data) against the pubkey => {0 or 1}
// push to stack [...stack, bigint]
export class Ed25519verify extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3, this.line);
    const pubkey = this.assertBytes(stack.pop(), this.line);
    const signature = this.assertBytes(stack.pop(), this.line);
    const data = this.assertBytes(stack.pop(), this.line);

    const addr = encodeAddress(pubkey);
    const isValid = verifyBytes(data, signature, addr);
    if (isValid) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// If A < B pushes '1' else '0'
// push to stack [...stack, bigint]
export class LessThan extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (prev < last) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// If A > B pushes '1' else '0'
// push to stack [...stack, bigint]
export class GreaterThan extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (prev > last) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// If A <= B pushes '1' else '0'
// push to stack [...stack, bigint]
export class LessThanEqualTo extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (prev <= last) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// If A >= B pushes '1' else '0'
// push to stack [...stack, bigint]
export class GreaterThanEqualTo extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (prev >= last) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// If A && B is true pushes '1' else '0'
// push to stack [...stack, bigint]
export class And extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (last && prev) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// If A || B is true pushes '1' else '0'
// push to stack [...stack, bigint]
export class Or extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    const prev = this.assertBigInt(stack.pop(), this.line);
    if (prev || last) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// If A == B pushes '1' else '0'
// push to stack [...stack, bigint]
export class EqualTo extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = stack.pop();
    const prev = stack.pop();
    if (typeof last !== typeof prev) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, {
        expected: typeof prev,
        actual: typeof last,
        line: this.line
      });
    }
    if (typeof last === "bigint") {
      stack = this.pushBooleanCheck(stack, (last === prev));
    } else {
      stack = this.pushBooleanCheck(stack,
        compareArray(this.assertBytes(last, this.line), this.assertBytes(prev, this.line)));
    }
  }
}

// If A != B pushes '1' else '0'
// push to stack [...stack, bigint]
export class NotEqualTo extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const last = stack.pop();
    const prev = stack.pop();
    if (typeof last !== typeof prev) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, {
        expected: typeof prev,
        actual: typeof last,
        line: this.line
      });
    }
    if (typeof last === "bigint") {
      stack = this.pushBooleanCheck(stack, last !== prev);
    } else {
      stack = this.pushBooleanCheck(stack,
        !compareArray(this.assertBytes(last, this.line), this.assertBytes(prev, this.line)));
    }
  }
}

// X == 0 yields 1; else 0
// push to stack [...stack, bigint]
export class Not extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);
    if (last === 0n) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// converts uint64 X to big endian bytes
// push to stack [...stack, big endian bytes]
export class Itob extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const uint64 = this.assertBigInt(stack.pop(), this.line);
    stack.push(encodeUint64(uint64));
  }
}

// converts bytes X as big endian to uint64
// btoi panics if the input is longer than 8 bytes.
// push to stack [...stack, bigint]
export class Btoi extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const bytes = this.assertBytes(stack.pop(), this.line);
    const uint64 = decodeUint64(bytes, DecodingMode.BIGINT);
    stack.push(uint64);
  }
}

// A plus B out to 128-bit long result as sum (top) and carry-bit uint64 values on the stack
// push to stack [...stack, bigint]
export class Addw extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const valueA = this.assertBigInt(stack.pop(), this.line);
    const valueB = this.assertBigInt(stack.pop(), this.line);
    let valueC = valueA + valueB;

    if (valueC > MAX_UINT64) {
      valueC -= MAX_UINT64;
      stack.push(1n);
      stack.push(valueC - 1n);
    } else {
      stack.push(0n);
      stack.push(valueC);
    }
  }
}

// A times B out to 128-bit long result as low (top) and high uint64 values on the stack
// push to stack [...stack, bigint]
export class Mulw extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const valueA = this.assertBigInt(stack.pop(), this.line);
    const valueB = this.assertBigInt(stack.pop(), this.line);
    const result = valueA * valueB;

    const low = result & MAX_UINT64;
    this.checkOverflow(low, this.line, MAX_UINT64);

    const high = result >> BigInt('64');
    this.checkOverflow(high, this.line, MAX_UINT64);

    stack.push(high);
    stack.push(low);
  }
}

// Pop one element from stack
// [...stack] // pop value.
export class Pop extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    stack.pop();
  }
}

// duplicate last value on stack
// push to stack [...stack, duplicate value]
export class Dup extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const lastValue = stack.pop();

    stack.push(lastValue);
    stack.push(lastValue);
  }
}

// duplicate two last values on stack: A, B -> A, B, A, B
// push to stack [...stack, B, A, B, A]
export class Dup2 extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const lastValueA = stack.pop();
    const lastValueB = stack.pop();

    stack.push(lastValueB);
    stack.push(lastValueA);
    stack.push(lastValueB);
    stack.push(lastValueA);
  }
}

// pop two byte strings A and B and join them, push the result
// concat panics if the result would be greater than 4096 bytes.
// push to stack [...stack, string]
export class Concat extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const valueA = this.assertBytes(stack.pop(), this.line);
    const valueB = this.assertBytes(stack.pop(), this.line);

    if (valueA.length + valueB.length > MAX_CONCAT_SIZE) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.CONCAT_ERROR, { line: this.line });
    }
    const c = new Uint8Array(valueB.length + valueA.length);
    c.set(valueB);
    c.set(valueA, valueB.length);
    stack.push(c);
  }
}

// pop last byte string X. For immediate values in 0..255 M and N:
// extract last range of bytes from it starting at M up to but not including N,
// push the substring result. If N < M, or either is larger than the string length,
// the program fails
// push to stack [...stack, substring]
export class Substring extends Op {
  readonly start: bigint;
  readonly end: bigint;
  readonly line: number;

  /**
   * Stores values of `start` and `end` according to arguments passed.
   * @param args Expected arguments: [start index number, end index number]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 2, line);
    assertOnlyDigits(args[0], line);
    assertOnlyDigits(args[1], line);

    this.start = BigInt(args[0]);
    this.end = BigInt(args[1]);
  };

  execute (stack: TEALStack): void {
    const end = this.assertUint8(this.end, this.line);
    const start = this.assertUint8(this.start, this.line);
    const byteString = this.assertBytes(stack.pop(), this.line);

    const subString = this.subString(byteString, start, end, this.line);
    stack.push(subString);
  }
}

// pop a byte-array A and two integers B and C.
// Extract a range of bytes from A starting at B up to but not including C,
// push the substring result. If C < B, or either is larger than the array length,
// the program fails
// push to stack [...stack, substring]
export class Substring3 extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    const end = this.assertBigInt(stack.pop(), this.line);
    const start = this.assertBigInt(stack.pop(), this.line);
    const byteString = this.assertBytes(stack.pop(), this.line);

    const subString = this.subString(byteString, start, end, this.line);
    stack.push(subString);
  }
}

// push field from current transaction to stack
// push to stack [...stack, transaction field]
export class Txn extends Op {
  readonly field: string;
  readonly idx: number | undefined;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Set transaction field according to arguments passed
   * @param args Expected arguments: [transaction field]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    this.idx = undefined;

    this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);
    if (TxArrFields[interpreter.tealVersion].has(args[0])) { // eg. txn Accounts 1
      assertLen(args.length, 2, line);
      assertOnlyDigits(args[1], line);
      this.idx = Number(args[1]);
    } else {
      assertLen(args.length, 1, line);
    }
    this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);

    this.field = args[0]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    let result;
    if (this.idx !== undefined) { // if field is an array use txAppArg (with "Accounts"/"ApplicationArgs"/'Assets'..)
      result = txAppArg(this.field, this.interpreter.runtime.ctx.tx, this.idx, this,
        this.interpreter.tealVersion, this.line);
    } else {
      result = txnSpecbyField(
        this.field,
        this.interpreter.runtime.ctx.tx,
        this.interpreter.runtime.ctx.gtxs,
        this.interpreter.tealVersion);
    }
    stack.push(result);
  }
}

// push field to the stack from a transaction in the current transaction group
// If this transaction is i in the group, gtxn i field is equivalent to txn field.
// push to stack [...stack, transaction field]
export class Gtxn extends Op {
  readonly field: string;
  readonly txFieldIdx: number | undefined;
  readonly interpreter: Interpreter;
  readonly line: number;
  protected txIdx: number;

  /**
   * Sets `field`, `txIdx` values according to arguments passed.
   * @param args Expected arguments: [transaction group index, transaction field]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    this.txFieldIdx = undefined;
    if (TxArrFields[interpreter.tealVersion].has(args[1])) {
      assertLen(args.length, 3, line); // eg. gtxn 0 Accounts 1
      assertOnlyDigits(args[2], line);
      this.txFieldIdx = Number(args[2]);
    } else {
      assertLen(args.length, 2, line);
    }
    assertOnlyDigits(args[0], line);
    this.assertTxFieldDefined(args[1], interpreter.tealVersion, line);

    this.txIdx = Number(args[0]); // transaction group index
    this.field = args[1]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertUint8(BigInt(this.txIdx), this.line);
    this.checkIndexBound(this.txIdx, this.interpreter.runtime.ctx.gtxs, this.line);
    let result;

    if (this.txFieldIdx !== undefined) {
      const tx = this.interpreter.runtime.ctx.gtxs[this.txIdx]; // current tx
      result = txAppArg(this.field, tx, this.txFieldIdx, this, this.interpreter.tealVersion, this.line);
    } else {
      result = txnSpecbyField(
        this.field,
        this.interpreter.runtime.ctx.gtxs[this.txIdx],
        this.interpreter.runtime.ctx.gtxs,
        this.interpreter.tealVersion);
    }
    stack.push(result);
  }
}

/**
 * push value of an array field from current transaction to stack
 * push to stack [...stack, value of an array field ]
 * NOTE: a) for arg="Accounts" index 0 means sender's address, and index 1 means first address
 * from accounts array (eg. txna Accounts 1: will push 1st address from Accounts[] to stack)
 * b) for arg="ApplicationArgs" index 0 means first argument for application array (normal indexing)
 */
export class Txna extends Op {
  readonly field: string;
  readonly interpreter: Interpreter;
  readonly line: number;
  idx: number;

  /**
   * Sets `field` and `idx` values according to arguments passed.
   * @param args Expected arguments: [transaction field, transaction field array index]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 2, line);
    assertOnlyDigits(args[1], line);
    this.assertTxArrFieldDefined(args[0], interpreter.tealVersion, line);

    this.field = args[0]; // field
    this.idx = Number(args[1]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    const result = txAppArg(this.field, this.interpreter.runtime.ctx.tx, this.idx, this,
      this.interpreter.tealVersion, this.line);
    stack.push(result);
  }
}

/// placeholder values
const mockTxIdx = "100";
const mockTxField = "f";
const mockTxFieldIdx = "200";

/**
 * push value of a field to the stack from a transaction in the current transaction group
 * push to stack [...stack, value of field]
 * NOTE: for arg="Accounts" index 0 means sender's address, and index 1 means first address from accounts
 * array (eg. gtxna 0 Accounts 1: will push 1st address from Accounts[](from the 1st tx in group) to stack)
 * b) for arg="ApplicationArgs" index 0 means first argument for application array (normal indexing)
 */
export class Gtxna extends Op {
  readonly field: string;
  readonly interpreter: Interpreter;
  readonly line: number;
  idx: number; // array index
  protected txIdx: number; // transaction group index

  /**
   * Sets `field`(Transaction Field), `idx`(Array Index) and
   * `txIdx`(Transaction Group Index) values according to arguments passed.
   * @param args Expected arguments:
   *   [transaction group index, transaction field, transaction field array index]
   *   Note: Transaction field is expected as string instead of a number.
   *   For ex: `"Fee"` rather than `0`.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 3, line);
    assertOnlyDigits(args[0], line);
    assertOnlyDigits(args[2], line);
    this.assertTxArrFieldDefined(args[1], interpreter.tealVersion, line);

    this.txIdx = Number(args[0]); // transaction group index
    this.field = args[1]; // field
    this.idx = Number(args[2]); // transaction field array index
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertUint8(BigInt(this.txIdx), this.line);
    this.checkIndexBound(this.txIdx, this.interpreter.runtime.ctx.gtxs, this.line);
    const tx = this.interpreter.runtime.ctx.gtxs[this.txIdx];
    const result = txAppArg(this.field, tx, this.idx, this, this.interpreter.tealVersion, this.line);
    stack.push(result);
  }
}

// represents branch name of a new branch
// push to stack [...stack]
export class Label extends Op {
  readonly label: string;
  readonly line: number;

  /**
   * Sets `label` according to arguments passed.
   * @param args Expected arguments: [label]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0].split(':')[0];
    this.line = line;
  };

  execute (stack: TEALStack): void { }
}

// branch unconditionally to label - Tealv <= 3
// push to stack [...stack]
export class Branch extends Op {
  readonly label: string;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets `label` according to arguments passed.
   * @param args Expected arguments: [label of branch]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0];
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.interpreter.jumpForward(this.label, this.line);
  }
}

// branch unconditionally to label - TEALv4
// can also jump backward
// push to stack [...stack]
export class Branchv4 extends Branch {
  execute (stack: TEALStack): void {
    this.interpreter.jumpToLabel(this.label, this.line);
  }
}

// branch conditionally if top of stack is zero - Teal version <= 3
// push to stack [...stack]
export class BranchIfZero extends Op {
  readonly label: string;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets `label` according to arguments passed.
   * @param args Expected arguments: [label of branch]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0];
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);

    if (last === 0n) {
      this.interpreter.jumpForward(this.label, this.line);
    }
  }
}

// branch conditionally if top of stack is zero - Tealv4
// can jump forward also
// push to stack [...stack]
export class BranchIfZerov4 extends BranchIfZero {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);

    if (last === 0n) {
      this.interpreter.jumpToLabel(this.label, this.line);
    }
  }
}

// branch conditionally if top of stack is non zero
// push to stack [...stack]
export class BranchIfNotZero extends Op {
  readonly label: string;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets `label` according to arguments passed.
   * @param args Expected arguments: [label of branch]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0];
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);

    if (last !== 0n) {
      this.interpreter.jumpForward(this.label, this.line);
    }
  }
}

// branch conditionally if top of stack is non zero - Tealv4
// can jump forward as well
// push to stack [...stack]
export class BranchIfNotZerov4 extends BranchIfNotZero {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const last = this.assertBigInt(stack.pop(), this.line);

    if (last !== 0n) {
      this.interpreter.jumpToLabel(this.label, this.line);
    }
  }
}

// use last value on stack as success value; end
// push to stack [...stack, last]
export class Return extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);

    const last = stack.pop();
    while (stack.length()) {
      stack.pop();
    }
    stack.push(last); // use last value as success
    this.interpreter.instructionIndex = this.interpreter.instructions.length; // end execution
  }
}

// push field from current transaction to stack
export class Global extends Op {
  readonly field: string;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores global field to query as string
   * @param args Expected arguments: [field] // Ex: ["GroupSize"]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.assertGlobalDefined(args[0], interpreter.tealVersion, line);

    this.field = args[0]; // global field
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    let result;
    switch (this.field) {
      case 'GroupSize': {
        result = this.interpreter.runtime.ctx.gtxs.length;
        break;
      }
      case 'CurrentApplicationID': {
        result = this.interpreter.runtime.ctx.tx.apid;
        this.interpreter.runtime.assertAppDefined(
          result as number,
          this.interpreter.getApp(result as number, this.line),
          this.line);
        break;
      }
      case 'Round': {
        result = this.interpreter.runtime.getRound();
        break;
      }
      case 'LatestTimestamp': {
        result = this.interpreter.runtime.getTimestamp();
        break;
      }
      case 'CreatorAddress': {
        const appID = this.interpreter.runtime.ctx.tx.apid;
        const app = this.interpreter.getApp(appID, this.line);
        result = decodeAddress(app.creator).publicKey;
        break;
      }
      case 'GroupID': {
        result = Uint8Array.from(this.interpreter.runtime.ctx.tx.grp ?? ZERO_ADDRESS);
        break;
      }
      case 'CurrentApplicationAddress': {
        const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
        result = decodeAddress(getApplicationAddress(appID)).publicKey;
        break;
      }
      default: {
        result = GlobalFields[this.interpreter.tealVersion][this.field];
      }
    }

    if (typeof result === 'number') {
      stack.push(BigInt(result));
    } else {
      stack.push(result);
    }
  }
}

// check if account specified by Txn.Accounts[A] opted in for the application B => {0 or 1}
// params: account index, application id (top of the stack on opcode entry).
// push to stack [...stack, 1] if opted in
// push to stack[...stack, 0] 0 otherwise
export class AppOptedIn extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const appRef = this.assertBigInt(stack.pop(), this.line);
    const accountRef: StackElem = stack.pop(); // index to tx.accounts[] OR an address directly

    const account = this.interpreter.getAccount(accountRef, this.line);
    const localState = account.appsLocalState;

    const appID = this.interpreter.getAppIDByReference(Number(appRef), false, this.line, this);
    const isOptedIn = localState.get(appID);
    if (isOptedIn) {
      stack.push(1n);
    } else {
      stack.push(0n);
    }
  }
}

// read from account specified by Txn.Accounts[A] from local state of the current application key B => value
// push to stack [...stack, bigint/bytes] If key exist
// push to stack [...stack, 0] otherwise
export class AppLocalGet extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const key = this.assertBytes(stack.pop(), this.line);
    const accountRef: StackElem = stack.pop();

    const account = this.interpreter.getAccount(accountRef, this.line);
    const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;

    const val = account.getLocalState(appID, key);
    if (val) {
      stack.push(val);
    } else {
      stack.push(0n); // The value is zero if the key does not exist.
    }
  }
}

// read from application local state at Txn.Accounts[A] => app B => key C from local state.
// push to stack [...stack, value, 1] (Note: value is 0 if key does not exist)
export class AppLocalGetEx extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3, this.line);
    const key = this.assertBytes(stack.pop(), this.line);
    const appRef = this.assertBigInt(stack.pop(), this.line);
    const accountRef: StackElem = stack.pop();

    const appID = this.interpreter.getAppIDByReference(Number(appRef), false, this.line, this);
    const account = this.interpreter.getAccount(accountRef, this.line);
    const val = account.getLocalState(appID, key);
    if (val) {
      stack.push(val);
      stack.push(1n);
    } else {
      stack.push(0n); // The value is zero if the key does not exist.
      stack.push(0n); // did_exist_flag
    }
  }
}

// read key A from global state of a current application => value
// push to stack[...stack, 0] if key doesn't exist
// otherwise push to stack [...stack, value]
export class AppGlobalGet extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const key = this.assertBytes(stack.pop(), this.line);

    const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
    const val = this.interpreter.getGlobalState(appID, key, this.line);
    if (val) {
      stack.push(val);
    } else {
      stack.push(0n); // The value is zero if the key does not exist.
    }
  }
}

// read from application Txn.ForeignApps[A] global state key B pushes to the stack
// push to stack [...stack, value, 1] (Note: value is 0 if key does not exist)
// A is specified as an account index in the ForeignApps field of the ApplicationCall transaction,
// zero index means this app
export class AppGlobalGetEx extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const key = this.assertBytes(stack.pop(), this.line);
    // appRef could be index to foreign apps array,
    // or since v4 an application id that appears in Txn.ForeignApps
    const appRef = this.assertBigInt(stack.pop(), this.line);

    const appID = this.interpreter.getAppIDByReference(Number(appRef), true, this.line, this);
    const val = this.interpreter.getGlobalState(appID, key, this.line);
    if (val) {
      stack.push(val);
      stack.push(1n);
    } else {
      stack.push(0n); // The value is zero if the key does not exist.
      stack.push(0n); // did_exist_flag
    }
  }
}

// write to account specified by Txn.Accounts[A] to local state of a current application key B with value C
// pops from stack [...stack, value, key]
// pushes nothing to stack, updates the app user local storage
export class AppLocalPut extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3, this.line);
    const value = stack.pop();
    const key = this.assertBytes(stack.pop(), this.line);
    const accountRef: StackElem = stack.pop();

    const account = this.interpreter.getAccount(accountRef, this.line);
    const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;

    // get updated local state for account
    const localState = account.setLocalState(appID, key, value, this.line);
    const acc = this.interpreter.runtime.assertAccountDefined(account.address,
      this.interpreter.runtime.ctx.state.accounts.get(account.address), this.line);
    acc.appsLocalState.set(appID, localState);
  }
}

// write key A and value B to global state of the current application
// push to stack [...stack]
export class AppGlobalPut extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const value = stack.pop();
    const key = this.assertBytes(stack.pop(), this.line);

    const appID = this.interpreter.runtime.ctx.tx.apid ?? 0; // if undefined use 0 as default
    this.interpreter.setGlobalState(appID, key, value, this.line);
  }
}

// delete from account specified by Txn.Accounts[A] local state key B of the current application
// push to stack [...stack]
export class AppLocalDel extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const key = this.assertBytes(stack.pop(), this.line);
    const accountRef: StackElem = stack.pop();

    const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
    const account = this.interpreter.getAccount(accountRef, this.line);

    const localState = account.appsLocalState.get(appID);
    if (localState) {
      localState["key-value"].delete(key.toString()); // delete from local state

      let acc = this.interpreter.runtime.ctx.state.accounts.get(account.address);
      acc = this.interpreter.runtime.assertAccountDefined(account.address, acc, this.line);
      acc.appsLocalState.set(appID, localState);
    }
  }
}

// delete key A from a global state of the current application
// push to stack [...stack]
export class AppGlobalDel extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const key = this.assertBytes(stack.pop(), this.line);

    const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;

    const app = this.interpreter.getApp(appID, this.line);
    if (app) {
      const globalState = app["global-state"];
      globalState.delete(key.toString());
    }
  }
}

// get balance for the requested account specified
// by Txn.Accounts[A] in microalgos. A is specified as an account
// index in the Accounts field of the ApplicationCall transaction,
// zero index means the sender
// push to stack [...stack, bigint]
export class Balance extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts if arguments length is zero
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter Interpreter Object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.interpreter = interpreter;
    this.line = line;

    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const accountRef: StackElem = stack.pop();
    const acc = this.interpreter.getAccount(accountRef, this.line);

    stack.push(BigInt(acc.balance()));
  }
}

// For Account A, Asset B (txn.accounts[A]) pushes to the
// push to stack [...stack, value(bigint/bytes), 1]
// NOTE: if account has no B holding then value = 0, did_exist = 0,
export class GetAssetHolding extends Op {
  readonly interpreter: Interpreter;
  readonly field: string;
  readonly line: number;

  /**
   * Sets field according to arguments passed.
   * @param args Expected arguments: [Asset Holding field]
   * // Note: Asset holding field will be string
   * For ex: `AssetBalance` is correct `0` is not.
   * @param line line number in TEAL file
   * @param interpreter Interpreter Object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.interpreter = interpreter;
    this.line = line;
    assertLen(args.length, 1, line);

    this.field = args[0];
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const assetRef = this.assertBigInt(stack.pop(), this.line);
    const accountRef: StackElem = stack.pop();

    const account = this.interpreter.getAccount(accountRef, this.line);
    const assetID = this.interpreter.getAssetIDByReference(Number(assetRef), false, this.line, this);
    const assetInfo = account.assets.get(assetID);
    if (assetInfo === undefined) {
      stack.push(0n);
      stack.push(0n);
      return;
    }
    let value: StackElem;
    switch (this.field) {
      case "AssetBalance":
        value = BigInt(assetInfo.amount);
        break;
      case "AssetFrozen":
        value = assetInfo["is-frozen"] ? 1n : 0n;
        break;
      default:
        throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_FIELD_TYPE, { line: this.line });
    }

    stack.push(value);
    stack.push(1n);
  }
}

// get Asset Params Info for given account
// For Index in ForeignAssets array
// push to stack [...stack, value(bigint/bytes), did_exist]
// NOTE: if asset doesn't exist, then did_exist = 0, value = 0
export class GetAssetDef extends Op {
  readonly interpreter: Interpreter;
  readonly field: string;
  readonly line: number;

  /**
   * Sets transaction field according to arguments passed
   * @param args Expected arguments: [Asset Params field]
   * // Note: Asset Params field will be string
   * For ex: `AssetTotal` is correct `0` is not.
   * @param line line number in TEAL file
   * @param interpreter Interpreter Object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    this.interpreter = interpreter;
    assertLen(args.length, 1, line);
    if (AssetParamMap[interpreter.tealVersion][args[0]] === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_ASSET_FIELD, {
        field: args[0],
        line: line,
        tealV: interpreter.tealVersion
      });
    }

    this.field = args[0];
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const assetRef = this.assertBigInt(stack.pop(), this.line);
    const assetID = this.interpreter.getAssetIDByReference(Number(assetRef), true, this.line, this);
    const AssetDefinition = this.interpreter.getAssetDef(assetID);
    let def: string;

    if (AssetDefinition === undefined) {
      stack.push(0n);
      stack.push(0n);
    } else {
      let value: StackElem;
      const s = AssetParamMap[this.interpreter.tealVersion][this.field] as keyof modelsv2.AssetParams;

      switch (this.field) {
        case "AssetTotal":
          value = BigInt(AssetDefinition.total);
          break;
        case "AssetDecimals":
          value = BigInt(AssetDefinition.decimals);
          break;
        case "AssetDefaultFrozen":
          value = AssetDefinition.defaultFrozen ? 1n : 0n;
          break;
        default:
          def = AssetDefinition[s] as string;
          if (isValidAddress(def)) {
            value = decodeAddress(def).publicKey;
          } else {
            value = parsing.stringToBytes(def);
          }
          break;
      }

      stack.push(value);
      stack.push(1n);
    }
  }
}

/** Pseudo-Ops **/
// push integer to stack
// push to stack [...stack, integer value]
export class Int extends Op {
  readonly uint64: bigint;
  readonly line: number;

  /**
   * Sets uint64 variable according to arguments passed.
   * @param args Expected arguments: [number]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);

    let uint64;
    const intConst = TxOnComplete[args[0] as keyof typeof TxOnComplete] ||
      TxnType[args[0] as keyof typeof TxnType];

    // check if string is keyof TxOnComplete or TxnType
    if (intConst !== undefined) {
      uint64 = BigInt(intConst);
    } else {
      const val = assertNumber(args[0], line);
      uint64 = BigInt(val);
    }

    this.checkOverflow(uint64, line, MAX_UINT64);
    this.uint64 = uint64;
  }

  execute (stack: TEALStack): void {
    stack.push(this.uint64);
  }
}

// push bytes to stack
// push to stack [...stack, converted data]
export class Byte extends Op {
  readonly str: string;
  readonly encoding: EncodingType;
  readonly line: number;

  /**
   * Sets `str` and  `encoding` values according to arguments passed.
   * @param args Expected arguments: [data string]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    [this.str, this.encoding] = getEncoding(args, line);
  }

  execute (stack: TEALStack): void {
    const buffer = convertToBuffer(this.str, this.encoding);
    stack.push(new Uint8Array(buffer));
  }
}

// decodes algorand address to bytes and pushes to stack
// push to stack [...stack, address]
export class Addr extends Op {
  readonly addr: string;
  readonly line: number;

  /**
   * Sets `addr` value according to arguments passed.
   * @param args Expected arguments: [Address]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 1, line);
    if (!isValidAddress(args[0])) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_ADDR, { addr: args[0], line: line });
    }
    this.addr = args[0];
    this.line = line;
  };

  execute (stack: TEALStack): void {
    const addr = decodeAddress(this.addr);
    stack.push(addr.publicKey);
  }
}

/* TEALv3 Ops */

// immediately fail unless value top is a non-zero number
// pops from stack: [...stack, uint64]
export class Assert extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const top = this.assertBigInt(stack.pop(), this.line);
    if (top === 0n) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.TEAL_ENCOUNTERED_ERR, { line: this.line });
    }
  }
}

// push immediate UINT to the stack as an integer
// push to stack: [...stack, uint64]
export class PushInt extends Op {
  /**
   * NOTE: in runtime this class is similar to Int, but from tealv3 perspective this is optimized
   * because pushint args are not added to the intcblock during assembly processes
   */
  readonly uint64: bigint;
  readonly line: number;

  /**
   * Sets uint64 variable according to arguments passed.
   * @param args Expected arguments: [number]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    assertOnlyDigits(args[0], line);

    this.checkOverflow(BigInt(args[0]), line, MAX_UINT64);
    this.uint64 = BigInt(args[0]);
  }

  execute (stack: TEALStack): void {
    stack.push(this.uint64);
  }
}

// push bytes to stack
// push to stack [...stack, converted data]
export class PushBytes extends Op {
  /**
   * NOTE: in runtime this class is similar to Byte, but from tealv3 perspective this is optimized
   * because pushbytes args are not added to the bytecblock during assembly processes
   */
  readonly str: string;
  readonly encoding: EncodingType;
  readonly line: number;

  /**
   * Sets `str` and  `encoding` values according to arguments passed.
   * @param args Expected arguments: [data string]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    [this.str, this.encoding] = getEncoding(args, line);
    if (this.encoding !== EncodingType.UTF8) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKOWN_DECODE_TYPE, { val: args[0], line: line });
    }
  }

  execute (stack: TEALStack): void {
    const buffer = convertToBuffer(this.str, this.encoding);
    stack.push(new Uint8Array(buffer));
  }
}

// swaps two last values on stack: A, B -> B, A (A,B = any)
// pops from stack: [...stack, A, B]
// pushes to stack: [...stack, B, A]
export class Swap extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const a = stack.pop();
    const b = stack.pop();
    stack.push(a);
    stack.push(b);
  }
}

/**
 * bit indexing begins with low-order bits in integers.
 * Setting bit 4 to 1 on the integer 0 yields 16 (int 0x0010, or 2^4).
 * Indexing begins in the first bytes of a byte-string
 * (as seen in getbyte and substring). Setting bits 0 through 11 to 1
 * in a 4 byte-array of 0s yields byte 0xfff00000
 * Pops from stack: [ ... stack, {any A}, {uint64 B}, {uint64 C} ]
 * Pushes to stack: [ ...stack, uint64 ]
 * pop a target A, index B, and bit C. Set the Bth bit of A to C, and push the result
 */
export class SetBit extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3, this.line);
    const bit = this.assertBigInt(stack.pop(), this.line);
    const index = this.assertBigInt(stack.pop(), this.line);
    const target = stack.pop();

    if (bit > 1n) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.SET_BIT_VALUE_ERROR, { line: this.line });
    }

    if (typeof target === "bigint") {
      this.assert64BitIndex(index, this.line);
      const binaryStr = target.toString(2);
      const binaryArr = [...(binaryStr.padStart(64, "0"))];
      const size = binaryArr.length;
      binaryArr[size - Number(index) - 1] = (bit === 0n ? "0" : "1");
      stack.push(parseBinaryStrToBigInt(binaryArr));
    } else {
      const byteIndex = Math.floor(Number(index) / 8);
      this.assertBytesIndex(byteIndex, target, this.line);

      const targetBit = Number(index) % 8;
      // 8th bit in a bytes array will be highest order bit in second element
      // that's why mask is reversed
      const mask = 1 << (7 - targetBit);
      if (bit === 1n) {
        // set bit
        target[byteIndex] |= mask;
      } else {
        // clear bit
        const mask = ~(1 << ((7 - targetBit)));
        target[byteIndex] &= mask;
      }
      stack.push(target);
    }
  }
}

/**
 * pop a target A (integer or byte-array), and index B. Push the Bth bit of A.
 * Pops from stack: [ ... stack, {any A}, {uint64 B}]
 * Pushes to stack: [ ...stack, uint64]
 */
export class GetBit extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const index = this.assertBigInt(stack.pop(), this.line);
    const target = stack.pop();

    if (typeof target === "bigint") {
      this.assert64BitIndex(index, this.line);
      const binaryStr = target.toString(2);
      const size = binaryStr.length;
      stack.push(BigInt(binaryStr[size - Number(index) - 1]));
    } else {
      const byteIndex = Math.floor(Number(index) / 8);
      this.assertBytesIndex(byteIndex, target, this.line);

      const targetBit = Number(index) % 8;
      const binary = target[byteIndex].toString(2);
      const str = binary.padStart(8, "0");
      stack.push(BigInt(str[targetBit]));
    }
  }
}

/**
 * pop a byte-array A, integer B, and
 * small integer C (between 0..255). Set the Bth byte of A to C, and push the result
 * Pops from stack: [ ...stack, {[]byte A}, {uint64 B}, {uint64 C}]
 * Pushes to stack: [ ...stack, []byte]
 */
export class SetByte extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3, this.line);
    const smallInteger = this.assertBigInt(stack.pop(), this.line);
    const index = this.assertBigInt(stack.pop(), this.line);
    const target = this.assertBytes(stack.pop(), this.line);
    this.assertUint8(smallInteger, this.line);
    this.assertBytesIndex(Number(index), target, this.line);

    target[Number(index)] = Number(smallInteger);
    stack.push(target);
  }
}

/**
 * pop a byte-array A and integer B. Extract the Bth byte of A and push it as an integer
 * Pops from stack: [ ...stack, {[]byte A}, {uint64 B} ]
 * Pushes to stack: [ ...stack, uint64 ]
 */
export class GetByte extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const index = this.assertBigInt(stack.pop(), this.line);
    const target = this.assertBytes(stack.pop(), this.line);
    this.assertBytesIndex(Number(index), target, this.line);

    stack.push(BigInt(target[Number(index)]));
  }
}

// push the Nth value (0 indexed) from the top of the stack.
// pops from stack: [...stack]
// pushes to stack: [...stack, any (nth slot from top of stack)]
// NOTE: dig 0 is same as dup
export class Dig extends Op {
  readonly line: number;
  readonly depth: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [ depth ] // slot to duplicate
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    assertOnlyDigits(args[0], line);

    this.assertUint8(BigInt(args[0]), line);
    this.depth = Number(args[0]);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, this.depth + 1, this.line);
    const tempStack = new Stack<StackElem>(this.depth + 1); // depth = 2 means 3rd slot from top of stack
    let target;
    for (let i = 0; i <= this.depth; ++i) {
      target = stack.pop();
      tempStack.push(target);
    }
    while (tempStack.length()) { stack.push(tempStack.pop()); }
    stack.push(target as StackElem);
  }
}

// selects one of two values based on top-of-stack: A, B, C -> (if C != 0 then B else A)
// pops from stack: [...stack, {any A}, {any B}, {uint64 C}]
// pushes to stack: [...stack, any (A or B)]
export class Select extends Op {
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3, this.line);
    const toCheck = this.assertBigInt(stack.pop(), this.line);
    const notZeroSelection = stack.pop();
    const isZeroSelection = stack.pop();

    if (toCheck !== 0n) { stack.push(notZeroSelection); } else { stack.push(isZeroSelection); }
  }
}

/**
 * push field F of the Ath transaction (A = top of stack) in the current group
 * pops from stack: [...stack, uint64]
 * pushes to stack: [...stack, transaction field]
 * NOTE: "gtxns field" is equivalent to "gtxn _i_ field" (where _i_ is the index
 * of transaction in group, fetched from stack).
 * gtxns exists so that i can be calculated, often based on the index of the current transaction.
 */
export class Gtxns extends Gtxn {
  /**
   * Sets `field`, `txIdx` values according to arguments passed.
   * @param args Expected arguments: [transaction field]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    // NOTE: 100 is a mock value (max no of txns in group can be 16 atmost).
    // In gtxns & gtxnsa opcodes, index is fetched from top of stack.
    super(["100", ...args], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const top = this.assertBigInt(stack.pop(), this.line);
    this.assertUint8(top, this.line);
    this.txIdx = Number(top);
    super.execute(stack);
  }
}

/**
 * push Ith value of the array field F from the Ath (A = top of stack) transaction in the current group
 * pops from stack: [...stack, uint64]
 * push to stack [...stack, value of field]
 */
export class Gtxnsa extends Gtxna {
  /**
   * Sets `field`(Transaction Field), `idx`(Array Index) values according to arguments passed.
   * @param args Expected arguments: [transaction field(F), transaction field array index(I)]
   *   Note: Transaction field is expected as string instead of number.
   *   For ex: `"Fee"` is expected rather than `0`.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    // NOTE: txIdx will be updated in execute.
    // In gtxns & gtxnsa opcodes, index is fetched from top of stack.
    super([mockTxIdx, ...args], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const top = this.assertBigInt(stack.pop(), this.line);
    this.assertUint8(top, this.line);
    this.txIdx = Number(top);
    super.execute(stack);
  }
}

/**
 * get minimum required balance for the requested account specified by Txn.Accounts[A] in microalgos.
 * NOTE: A = 0 represents tx.sender account. Required balance is affected by ASA and App usage. When creating
 * or opting into an app, the minimum balance grows before the app code runs, therefore the increase
 * is visible there. When deleting or closing out, the minimum balance decreases after the app executes.
 * pops from stack: [...stack, uint64(account index)]
 * push to stack [...stack, uint64(min balance in microalgos)]
 */
export class MinBalance extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts if arguments length is zero
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter Interpreter Object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.interpreter = interpreter;
    this.line = line;

    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const accountRef: StackElem = stack.pop();
    const acc = this.interpreter.getAccount(accountRef, this.line);

    stack.push(BigInt(acc.minBalance));
  }
}

/** TEALv4 Ops **/

// push Ith scratch space index of the Tth transaction in the current group
// push to stack [...stack, bigint/bytes]
// Pops nothing
// Args expected: [{uint8 transaction group index}(T),
// {uint8 position in scratch space to load from}(I)]
export class Gload extends Op {
  readonly scratchIndex: number;
  txIndex: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores scratch space index and transaction index number according to arguments passed.
   * @param args Expected arguments: [index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 2, this.line);
    assertOnlyDigits(args[0], this.line);
    assertOnlyDigits(args[1], this.line);

    this.txIndex = Number(args[0]);
    this.scratchIndex = Number(args[1]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    const scratch = this.interpreter.runtime.ctx.sharedScratchSpace.get(this.txIndex);
    if (scratch === undefined) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.SCRATCH_EXIST_ERROR,
        { index: this.txIndex, line: this.line }
      );
    }
    this.checkIndexBound(this.scratchIndex, scratch, this.line);
    stack.push(scratch[this.scratchIndex]);
  }
}

// push Ith scratch space index of the Tth transaction in the current group
// push to stack [...stack, bigint/bytes]
// Pops uint64(T)
// Args expected: [{uint8 position in scratch space to load from}(I)]
export class Gloads extends Gload {
  /**
   * Stores scratch space index number according to argument passed.
   * @param args Expected arguments: [index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    // "11" is mock value, will be updated when poping from stack in execute
    super(["11", ...args], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    this.txIndex = Number(this.assertBigInt(stack.pop(), this.line));
    super.execute(stack);
  }
}

/**
 * Provide subroutine functionality. When callsub is called, the current location in
 * the program is saved and immediately jumps to the label passed to the opcode.
 * Pops: None
 * Pushes: None
 * The call stack is separate from the data stack. Only callsub and retsub manipulate it.
 * Pops: None
 * Pushes: Pushes current instruction index in call stack
 */
export class Callsub extends Op {
  readonly interpreter: Interpreter;
  readonly label: string;
  readonly line: number;

  /**
   * Sets `label` according to arguments passed.
   * @param args Expected arguments: [label of branch]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0];
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    // the current location in the program is saved
    this.interpreter.callStack.push(this.interpreter.instructionIndex);
    // immediately jumps to the label passed to the opcode.
    this.interpreter.jumpToLabel(this.label, this.line);
  }
}

/**
 * When the retsub opcode is called, the AVM will resume
 * execution at the previous saved point.
 * Pops: None
 * Pushes: None
 * The call stack is separate from the data stack. Only callsub and retsub manipulate it.
 * Pops: index from call stack
 * Pushes: None
 */
export class Retsub extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * @param args Expected arguments: []
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    // get current location from saved point
    // jump to saved instruction opcode
    if (this.interpreter.callStack.length() === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.CALL_STACK_EMPTY, { line: this.line });
    }
    this.interpreter.instructionIndex = this.interpreter.callStack.pop();
  }
}

// generic op to execute byteslice arithmetic
// `b+`, `b-`, `b*`, `b/`, `b%`, `b<`, `b>`, `b<=`,
// `b>=`, `b==`, `b!=`, `b\`, `b&`, `b^`, `b~`, `bzero`
export class ByteOp extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack, op: MathOp): void {
    this.assertMinStackLen(stack, 2, this.line);
    const byteB = this.assertBytes(stack.pop(), this.line, MAX_INPUT_BYTE_LEN);
    const byteA = this.assertBytes(stack.pop(), this.line, MAX_INPUT_BYTE_LEN);
    const bigIntB = bigEndianBytesToBigInt(byteB);
    const bigIntA = bigEndianBytesToBigInt(byteA);

    let r: bigint | boolean;
    switch (op) {
      case MathOp.Add: {
        r = bigIntA + bigIntB;
        break;
      }
      case MathOp.Sub: {
        r = bigIntA - bigIntB;
        this.checkUnderflow(r, this.line);
        break;
      }
      case MathOp.Mul: {
        // NOTE: 12n * 0n == 0n, but in bytesclice arithmatic, this is equivalent to
        // empty bytes (eg. byte "A" * byte "" === byte "")
        r = bigIntA * bigIntB;
        break;
      }
      case MathOp.Div: {
        if (bigIntB === 0n) {
          throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
        }
        r = bigIntA / bigIntB;
        break;
      }
      case MathOp.Mod: {
        if (bigIntB === 0n) {
          throw new RuntimeError(RUNTIME_ERRORS.TEAL.ZERO_DIV, { line: this.line });
        }
        r = bigIntA % bigIntB;
        break;
      }
      case MathOp.LessThan: {
        r = bigIntA < bigIntB;
        break;
      }
      case MathOp.GreaterThan: {
        r = bigIntA > bigIntB;
        break;
      }
      case MathOp.LessThanEqualTo: {
        r = bigIntA <= bigIntB;
        break;
      }
      case MathOp.GreaterThanEqualTo: {
        r = bigIntA >= bigIntB;
        break;
      }
      case MathOp.EqualTo: {
        r = bigIntA === bigIntB;
        break;
      }
      case MathOp.NotEqualTo: {
        r = bigIntA !== bigIntB;
        break;
      }
      case MathOp.BitwiseOr: {
        r = bigIntA | bigIntB;
        break;
      }
      case MathOp.BitwiseAnd: {
        r = bigIntA & bigIntB;
        break;
      }
      case MathOp.BitwiseXor: {
        r = bigIntA ^ bigIntB;
        break;
      }
      default: {
        throw new Error('Operation not supported');
      }
    }

    if (typeof r === 'boolean') {
      stack.push(BigInt(r)); // 0 or 1
    } else {
      const resultAsBytes =
        r === 0n ? new Uint8Array([]) : bigintToBigEndianBytes(r);
      if (op === MathOp.BitwiseOr || op === MathOp.BitwiseAnd || op === MathOp.BitwiseXor) {
        // for bitwise ops, zero's are "left" padded upto length.max(byteB, byteA)
        // https://developer.algorand.org/docs/reference/teal/specification/#arithmetic-logic-and-cryptographic-operations
        const maxSize = Math.max(byteA.length, byteB.length);

        const paddedZeroArr = new Uint8Array(Math.max(0, maxSize - resultAsBytes.length)).fill(0);
        const mergedArr = new Uint8Array(maxSize);
        mergedArr.set(paddedZeroArr);
        mergedArr.set(resultAsBytes, paddedZeroArr.length);
        stack.push(this.assertBytes(mergedArr, this.line, MAX_OUTPUT_BYTE_LEN));
      } else {
        stack.push(this.assertBytes(resultAsBytes, this.line, MAX_OUTPUT_BYTE_LEN));
      }
    }
  }
}

// A plus B, where A and B are byte-arrays interpreted as big-endian unsigned integers
// panics on overflow (result > max_uint1024 i.e 128 byte num)
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteAdd extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.Add);
  }
}

// A minus B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Panic on underflow.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteSub extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.Sub);
  }
}

// A times B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteMul extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.Mul);
  }
}

// A divided by B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Panic if B is zero.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteDiv extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.Div);
  }
}

// A modulo B, where A and B are byte-arrays interpreted as big-endian unsigned integers.
// Panic if B is zero.
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, []byte]
export class ByteMod extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.Mod);
  }
}

// A is greater than B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteGreatorThan extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.GreaterThan);
  }
}

// A is less than B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteLessThan extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.LessThan);
  }
}

// A is greater than or equal to B, where A and B are byte-arrays interpreted
// as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteGreaterThanEqualTo extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.GreaterThanEqualTo);
  }
}

// A is less than or equal to B, where A and B are byte-arrays interpreted as
// big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteLessThanEqualTo extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.LessThanEqualTo);
  }
}

// A is equals to B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteEqualTo extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.EqualTo);
  }
}

// A is not equal to B, where A and B are byte-arrays interpreted as big-endian unsigned integers => { 0 or 1}
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteNotEqualTo extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.NotEqualTo);
  }
}

// A bitwise-or B, where A and B are byte-arrays, zero-left extended to the greater of their lengths
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteBitwiseOr extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.BitwiseOr);
  }
}

// A bitwise-and B, where A and B are byte-arrays, zero-left extended to the greater of their lengths
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteBitwiseAnd extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.BitwiseAnd);
  }
}

// A bitwise-xor B, where A and B are byte-arrays, zero-left extended to the greater of their lengths
// Pops: ... stack, {[]byte A}, {[]byte B}
// push to stack [...stack, uint64]
export class ByteBitwiseXor extends ByteOp {
  execute (stack: TEALStack): void {
    super.execute(stack, MathOp.BitwiseXor);
  }
}

// X (bytes array) with all bits inverted
// Pops: ... stack, []byte
// push to stack [...stack, byte[]]
export class ByteBitwiseInvert extends ByteOp {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const byteA = this.assertBytes(stack.pop(), this.line, MAX_INPUT_BYTE_LEN);
    stack.push(byteA.map(b => (255 - b)));
  }
}

// push a byte-array of length X, containing all zero bytes
// Pops: ... stack, uint64
// push to stack [...stack, byte[]]
export class ByteZero extends ByteOp {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const len = this.assertBigInt(stack.pop(), this.line);
    const result = new Uint8Array(Number(len)).fill(0);
    stack.push(this.assertBytes(result, this.line, 4096));
  }
}

/**
 * Pop four uint64 values. The deepest two are interpreted
 * as a uint128 dividend (deepest value is high word),
 * the top two are interpreted as a uint128 divisor.
 * Four uint64 values are pushed to the stack.
 * The deepest two are the quotient (deeper value
 * is the high uint64). The top two are the remainder, low bits on top.
 * Pops: ... stack, {uint64 A}, {uint64 B}, {uint64 C}, {uint64 D}
 * Pushes: ... stack, uint64, uint64, uint64, uint64
 */
export class DivModw extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    // Go-algorand implementation: https://github.com/algorand/go-algorand/blob/8f743a98827372bfd8928de3e0b70390ff34f407/data/transactions/logic/eval.go#L927
    const firstLow = this.assertBigInt(stack.pop(), this.line);
    const firstHigh = this.assertBigInt(stack.pop(), this.line);

    let divisor = firstHigh << BigInt('64');
    divisor = divisor + firstLow;

    const secondLow = this.assertBigInt(stack.pop(), this.line);
    const secondHigh = this.assertBigInt(stack.pop(), this.line);

    let dividend = secondHigh << BigInt('64');
    dividend = dividend + secondLow;

    const quotient = dividend / divisor;
    let low = quotient & MAX_UINT64;
    this.checkOverflow(low, this.line, MAX_UINT64);

    let high = quotient >> BigInt('64');
    this.checkOverflow(high, this.line, MAX_UINT64);

    stack.push(high);
    stack.push(low);

    const remainder = dividend % divisor;
    low = remainder & MAX_UINT64;
    this.checkOverflow(low, this.line, MAX_UINT64);

    high = remainder >> BigInt('64');
    this.checkOverflow(high, this.line, MAX_UINT64);

    stack.push(high);
    stack.push(low);
  }
}

// A raised to the Bth power. Panic if A == B == 0 and on overflow
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: uint64
export class Exp extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    const b = this.assertBigInt(stack.pop(), this.line);
    const a = this.assertBigInt(stack.pop(), this.line);

    if (a === 0n && b === 0n) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.EXP_ERROR, { line: this.line });
    }

    const res = a ** b;
    this.checkOverflow(res, this.line, MAX_UINT64);

    stack.push(res);
  }
}

// A raised to the Bth power as a 128-bit long result as
// low (top) and high uint64 values on the stack.
// Panic if A == B == 0 or if the results exceeds 2^128-1
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: ... stack, uint64, uint64
export class Expw extends Exp {
  execute (stack: TEALStack): void {
    const b = this.assertBigInt(stack.pop(), this.line);
    const a = this.assertBigInt(stack.pop(), this.line);

    if (a === 0n && b === 0n) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.EXP_ERROR, { line: this.line });
    }
    const res = a ** b;
    this.checkOverflow(res, this.line, MAX_UINT128);

    const low = res & MAX_UINT64;
    this.checkOverflow(low, this.line, MAX_UINT64);

    const high = res >> BigInt('64');
    this.checkOverflow(high, this.line, MAX_UINT64);

    stack.push(high);
    stack.push(low);
  }
}

// Left shift (A times 2^B, modulo 2^64)
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: uint64
export class Shl extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    const b = this.assertBigInt(stack.pop(), this.line);
    const a = this.assertBigInt(stack.pop(), this.line);

    const res = (a << b) % (2n ** 64n);

    stack.push(res);
  }
}

// Right shift (A divided by 2^B)
// Pops: ... stack, {uint64 A}, {uint64 B}
// Pushes: uint64
export class Shr extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    const b = this.assertBigInt(stack.pop(), this.line);
    const a = this.assertBigInt(stack.pop(), this.line);

    const res = a >> b;

    stack.push(res);
  }
}

// The largest integer B such that B^2 <= X
// Pops: ... stack, uint64
// Pushes: uint64
export class Sqrt extends Op {
  readonly line: number;
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    // https://stackoverflow.com/questions/53683995/javascript-big-integer-square-root
    const value = this.assertBigInt(stack.pop(), this.line);
    if (value < 2n) {
      stack.push(value);
      return;
    }

    if (value < 16n) {
      stack.push(BigInt(Math.floor(Math.sqrt(Number(value)))));
      return;
    }
    let x1;
    if (value < (1n << 52n)) {
      x1 = BigInt(Math.floor(Math.sqrt(Number(value)))) - 3n;
    } else {
      x1 = (1n << 52n) - 2n;
    }

    let x0 = -1n;
    while ((x0 !== x1 && x0 !== (x1 - 1n))) {
      x0 = x1;
      x1 = ((value / x0) + x0) >> 1n;
    }

    stack.push(x0);
  }
}

// Pops: None
// Pushes: uint64
// push the ID of the asset or application created in the Tth transaction of the current group
// gaid fails unless the requested transaction created an asset or application and T < GroupIndex.
export class Gaid extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;
  txIndex: number;

  /**
   * Asserts 1 arguments are passed.
   * @param args Expected arguments: [txIndex]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    this.interpreter = interpreter;
    assertLen(args.length, 1, line);
    this.txIndex = Number(args[0]);
  };

  execute (stack: TEALStack): void {
    const knowableID = this.interpreter.runtime.ctx.knowableID.get(this.txIndex);
    if (knowableID === undefined) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.GROUP_INDEX_EXIST_ERROR,
        { index: this.txIndex, line: this.line }
      );
    }

    stack.push(BigInt(knowableID));
  }
}

// Pops: ... stack, uint64
// Pushes: uint64
// push the ID of the asset or application created in the Xth transaction of the current group
// gaid fails unless the requested transaction created an asset or application and X < GroupIndex.
export class Gaids extends Gaid {
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: []
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    // "11" is mock value, will be updated when poping from stack in execute
    super(["11", ...args], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    this.txIndex = Number(this.assertBigInt(stack.pop(), this.line));
    super.execute(stack);
  }
}

// Pops: ... stack, []byte
// Pushes: []byte
// pop a byte-array A. Op code parameters:
// * S: number in 0..255, start index
// * L: number in 0..255, length
//  extracts a range of bytes from A starting at S up to but not including S+L,
// push the substring result. If L is 0, then extract to the end of the string.
// If S or S+L is larger than the array length, the program fails
export class Extract extends Op {
  readonly line: number;
  readonly start: number;
  length: number;

  /**
   * Asserts 2 arguments are passed.
   * @param args Expected arguments: [txIndex]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 2, line);
    this.start = Number(args[0]);
    this.length = Number(args[1]);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const array = this.assertBytes(stack.pop(), this.line);

    // if length is 0, take bytes from start index to the end
    if (this.length === 0) {
      this.length = array.length - this.start;
    }

    stack.push(this.opExtractImpl(array, this.start, this.length));
  }
}

// Pops: ... stack, {[]byte A}, {uint64 S}, {uint64 L}
// Pushes: []byte
// pop a byte-array A and two integers S and L (both in 0..255).
// Extract a range of bytes from A starting at S up to but not including S+L,
// push the substring result. If S+L is larger than the array length, the program fails
export class Extract3 extends Op {
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [txIndex]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3, this.line);
    const length = this.assertUInt8(stack.pop(), this.line);
    const start = this.assertUInt8(stack.pop(), this.line);
    const array = this.assertBytes(stack.pop(), this.line);

    stack.push(this.opExtractImpl(array, start, length));
  }
}

// Pops: ... stack, {[]byte A}, {uint64 S}
// Pushes: uint64
// Op code parameters:
// * N: number in {2,4,8}, length
// Base class to implement the extract_uint16, extract_uint32 and extract_uint64 op codes
// for N equal 2, 4, 8 respectively.
// pop a byte-array A and integer S (in 0..255). Extracts a range of bytes
// from A starting at S up to but not including B+N,
// convert bytes as big endian and push the uint(N*8) result.
// If B+N is larger than the array length, the program fails
class ExtractUintN extends Op {
  readonly line: number;
  extractBytes = 2;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [txIndex]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
    // this.extractBytes = 2;
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const start = this.assertUInt8(stack.pop(), this.line);
    const array = this.assertBytes(stack.pop(), this.line);

    const sliced = this.opExtractImpl(array, start, this.extractBytes); // extract n bytes
    stack.push(bigEndianBytesToBigInt(sliced));
  }
}

// Pops: ... stack, {[]byte A}, {uint64 B}
// Pushes: uint64
// pop a byte-array A and integer B. Extract a range of bytes
// from A starting at B up to but not including B+2,
// convert bytes as big endian and push the uint64 result.
// If B+2 is larger than the array length, the program fails
export class ExtractUint16 extends ExtractUintN {
  extractBytes = 2;
  execute (stack: TEALStack): void {
    super.execute(stack);
  }
}

// Pops: ... stack, {[]byte A}, {uint64 B}
// Pushes: uint64
// pop a byte-array A and integer B. Extract a range of bytes
// from A starting at B up to but not including B+4, convert
// bytes as big endian and push the uint64 result.
// If B+4 is larger than the array length, the program fails
export class ExtractUint32 extends ExtractUintN {
  extractBytes = 4;

  execute (stack: TEALStack): void {
    super.execute(stack);
  }
}

// Pops: ... stack, {[]byte A}, {uint64 B}
// Pushes: uint64
// pop a byte-array A and integer B. Extract a range of bytes from
// A starting at B up to but not including B+8, convert bytes as
// big endian and push the uint64 result. If B+8 is larger than
// the array length, the program fails
export class ExtractUint64 extends ExtractUintN {
  extractBytes = 8;

  execute (stack: TEALStack): void {
    super.execute(stack);
  }
}

// Pops: ... stack, {[]byte A}, {[]byte B}, {[]byte C}, {[]byte D}, {[]byte E}
// Pushes: uint64
// for (data A, signature B, C and pubkey D, E) verify the signature of the
// data against the pubkey => {0 or 1}
export class EcdsaVerify extends Op {
  readonly line: number;
  readonly curveIndex: number;

  /**
   * Asserts 1 arguments are passed.
   * @param args Expected arguments: [txIndex]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    this.curveIndex = Number(args[0]);
  };

  /**
   * The 32 byte Y-component of a public key is the last element on the stack,
   * preceded by X-component of a pubkey, preceded by S and R components of a
   * signature, preceded by the data that is fifth element on the stack.
   * All values are big-endian encoded. The signed data must be 32 bytes long,
   * and signatures in lower-S form are only accepted.
   */
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 5, this.line);
    const pubkeyE = this.assertBytes(stack.pop(), this.line);
    const pubkeyD = this.assertBytes(stack.pop(), this.line);
    const signatureC = this.assertBytes(stack.pop(), this.line);
    const signatureB = this.assertBytes(stack.pop(), this.line);
    const data = this.assertBytes(stack.pop(), this.line);

    if (this.curveIndex !== 0) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED, { line: this.line, index: this.curveIndex }
      );
    }

    const ec = new EC('secp256k1');
    const pub = { x: Buffer.from(pubkeyD).toString('hex'), y: Buffer.from(pubkeyE).toString('hex') };
    const key = ec.keyFromPublic(pub);
    const signature = { r: signatureB, s: signatureC };

    this.pushBooleanCheck(stack, key.verify(data, signature));
  }
}

// Pops: ... stack, []byte
// Pushes: ... stack, []byte, []byte
// decompress pubkey A into components X, Y => [... stack, X, Y]
export class EcdsaPkDecompress extends Op {
  readonly line: number;
  readonly curveIndex: number;

  /**
   * Asserts 1 arguments are passed.
   * @param args Expected arguments: [txIndex]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    this.curveIndex = Number(args[0]);
  };

  /**
   * The 33 byte public key in a compressed form to be decompressed into X and Y (top)
   * components. All values are big-endian encoded.
   */
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const pubkeyCompressed = this.assertBytes(stack.pop(), this.line);

    if (this.curveIndex !== 0) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED, { line: this.line, index: this.curveIndex }
      );
    }

    const ec = new EC('secp256k1');
    const publicKeyUncompressed = ec.keyFromPublic(pubkeyCompressed, 'hex').getPublic();
    const x = publicKeyUncompressed.getX();
    const y = publicKeyUncompressed.getY();

    stack.push(x.toBuffer());
    stack.push(y.toBuffer());
  }
}

// Pops: ... stack, {[]byte A}, {uint64 B}, {[]byte C}, {[]byte D}
// Pushes: ... stack, []byte, []byte
// for (data A, recovery id B, signature C, D) recover a public key => [... stack, X, Y]
export class EcdsaPkRecover extends Op {
  readonly line: number;
  readonly curveIndex: number;

  /**
   * Asserts 1 arguments are passed.
   * @param args Expected arguments: [txIndex]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    this.curveIndex = Number(args[0]);
  };

  /**
  * S (top) and R elements of a signature, recovery id and data (bottom) are
  * expected on the stack and used to deriver a public key. All values are
  * big-endian encoded. The signed data must be 32 bytes long.
  */
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 4, this.line);
    const signatureD = this.assertBytes(stack.pop(), this.line);
    const signatureC = this.assertBytes(stack.pop(), this.line);
    const recoverId = this.assertBigInt(stack.pop(), this.line);
    const data = this.assertBytes(stack.pop(), this.line);

    if (this.curveIndex !== 0) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.CURVE_NOT_SUPPORTED, { line: this.line, index: this.curveIndex }
      );
    }

    const ec = new EC('secp256k1');
    const signature = { r: signatureC, s: signatureD };
    const pubKey = ec.recoverPubKey(data, signature, Number(recoverId));
    const x = pubKey.getX();
    const y = pubKey.getY();

    stack.push(x.toBuffer());
    stack.push(y.toBuffer());
  }
}

// Pops: ...stack, any
// Pushes: any
// remove top of stack, and place it deeper in the stack such that
// N elements are above it. Fails if stack depth <= N.
export class Cover extends Op {
  readonly line: number;
  readonly nthInStack: number;

  /**
   * Asserts 1 arguments are passed.
   * @param args Expected arguments: [N]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    this.nthInStack = Number(args[0]);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, this.nthInStack + 1, this.line);

    const top = stack.pop();
    const temp = [];
    for (let count = 1; count <= this.nthInStack; ++count) {
      temp.push(stack.pop());
    }
    stack.push(top);
    for (let i = this.nthInStack - 1; i >= 0; --i) {
      stack.push(temp[i]);
    }
  }
}

// Pops: ... stack, any
// Pushes: any
// remove the value at depth N in the stack and shift above items down
// so the Nth deep value is on top of the stack. Fails if stack depth <= N.
export class Uncover extends Op {
  readonly line: number;
  readonly nthInStack: number;

  /**
   * Asserts 1 arguments are passed.
   * @param args Expected arguments: [N]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 1, line);
    this.nthInStack = Number(args[0]);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, this.nthInStack + 1, this.line);

    const temp = [];
    for (let count = 0; count < this.nthInStack; ++count) {
      temp.push(stack.pop());
    }

    const deepValue = stack.pop();

    for (let i = this.nthInStack - 1; i >= 0; --i) {
      stack.push(temp[i]);
    }
    stack.push(deepValue);
  }
}

// Pops: ... stack, uint64
// Pushes: any
// copy a value from the Xth scratch space to the stack.
// All scratch spaces are 0 at program start.
export class Loads extends Load {
  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: []
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    // "11" is mock value, will be updated when poping from stack in execute
    super(["11", ...args], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    this.index = Number(this.assertBigInt(stack.pop(), this.line));
    super.execute(stack);
  }
}

// Pops: ... stack, {uint64 A}, {any B}
// Pushes: None
// pop indexes A and B. store B to the Ath scratch space
export class Stores extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores index number according to arguments passed
   * @param args Expected arguments: []
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 0, this.line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const value = stack.pop();
    const index = this.assertBigInt(stack.pop(), this.line);
    this.checkIndexBound(Number(index), this.interpreter.scratch, this.line);
    this.interpreter.scratch[Number(index)] = value;
  }
}

// Pops: None
// Pushes: None
// Begin preparation of a new inner transaction
export class ITxnBegin extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores index number according to arguments passed
   * @param args Expected arguments: []
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 0, this.line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    if (typeof this.interpreter.subTxn !== "undefined") {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.ITXN_BEGIN_WITHOUT_ITXN_SUBMIT, { line: this.line });
    }

    if (this.interpreter.innerTxns.length >= MAX_INNER_TRANSACTIONS) {
      throw new RuntimeError(
        RUNTIME_ERRORS.GENERAL.MAX_INNER_TRANSACTIONS_EXCEEDED, {
          line: this.line,
          len: this.interpreter.innerTxns.length + 1,
          max: MAX_INNER_TRANSACTIONS
        });
    }

    // get app, assert it exists
    const appID = this.interpreter.runtime.ctx.tx.apid ?? 0;
    this.interpreter.runtime.assertAppDefined(
      appID, this.interpreter.getApp(appID, this.line), this.line
    );

    // get application's account
    const address = getApplicationAddress(appID);
    const applicationAccount = this.interpreter.runtime.assertAccountDefined(
      address,
      this.interpreter.runtime.ctx.state.accounts.get(address),
      this.line
    );

    // calculate feeCredit(extra fee) accross all txns
    let totalFee = 0;
    for (const t of this.interpreter.runtime.ctx.gtxs) {
      totalFee += (t.fee ?? 0);
    };
    for (const t of this.interpreter.innerTxns) {
      totalFee += (t.fee ?? 0);
    }

    const totalTxCnt = this.interpreter.runtime.ctx.gtxs.length + this.interpreter.innerTxns.length;
    const feeCredit = (totalFee - (ALGORAND_MIN_TX_FEE * totalTxCnt));

    let txFee;
    if (feeCredit >= ALGORAND_MIN_TX_FEE) {
      txFee = 0; // we have enough fee in pool
    } else {
      const diff = feeCredit - ALGORAND_MIN_TX_FEE;
      txFee = (diff >= 0) ? diff : ALGORAND_MIN_TX_FEE;
    }

    const txnParams = {
      // set sender, fee, fv, lv
      snd: Buffer.from(
        algosdk.decodeAddress(
          applicationAccount.address
        ).publicKey
      ),
      fee: txFee,
      fv: this.interpreter.runtime.ctx.tx.fv,
      lv: this.interpreter.runtime.ctx.tx.lv,
      // to avoid type hack
      gen: this.interpreter.runtime.ctx.tx.gen,
      gh: this.interpreter.runtime.ctx.tx.gh,
      txID: "",
      type: ""
    };

    this.interpreter.subTxn = txnParams;
  }
}

// Set field F of the current inner transaction to X(last value fetched from stack)
// itxn_field fails if X is of the wrong type for F, including a byte array
// of the wrong size for use as an address when F is an address field.
// itxn_field also fails if X is an account or asset that does not appear in txn.Accounts
// or txn.ForeignAssets of the top-level transaction.
// (Setting addresses in asset creation are exempted from this requirement.)
// pops from stack [...stack, any]
// push to stack [...stack, none]
export class ITxnField extends Op {
  readonly field: string;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Set transaction field according to arguments passed
   * @param args Expected arguments: [transaction field]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;

    this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);
    assertLen(args.length, 1, line);
    this.field = args[0]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const valToSet: StackElem = stack.pop();

    if (typeof this.interpreter.subTxn === "undefined") {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.ITXN_FIELD_WITHOUT_ITXN_BEGIN, { line: this.line });
    }

    const updatedSubTx =
      setInnerTxField(this.interpreter.subTxn, this.field, valToSet, this, this.interpreter, this.line);

    this.interpreter.subTxn = updatedSubTx;
  }
}

// Pops: None
// Pushes: None
// Execute the current inner transaction.
export class ITxnSubmit extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Stores index number according to arguments passed
   * @param args Expected arguments: []
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 0, this.line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    if (typeof this.interpreter.subTxn === "undefined") {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.ITXN_SUBMIT_WITHOUT_ITXN_BEGIN, { line: this.line });
    }

    // calculate fee accross all txns
    let totalFee = 0;
    for (const t of this.interpreter.runtime.ctx.gtxs) {
      totalFee += (t.fee ?? 0);
    };
    for (const t of this.interpreter.innerTxns) {
      totalFee += (t.fee ?? 0);
    }
    totalFee += (this.interpreter.subTxn.fee ?? 0);
    const totalTxCnt = this.interpreter.runtime.ctx.gtxs.length + this.interpreter.innerTxns.length + 1;

    // fee too less accross pool
    const feeBal = (totalFee - (ALGORAND_MIN_TX_FEE * totalTxCnt));
    if (feeBal < 0) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH, {
          required: ALGORAND_MIN_TX_FEE * totalTxCnt,
          collected: totalFee
        }
      );
    }

    // get execution txn params (parsed from encoded sdk txn obj)
    const execParams = parseEncodedTxnToExecParams(this.interpreter.subTxn, this.interpreter, this.line);
    const baseCurrTx = this.interpreter.runtime.ctx.tx;
    const baseCurrTxGrp = this.interpreter.runtime.ctx.gtxs;

    // execute innner transaction
    this.interpreter.runtime.ctx.tx = this.interpreter.subTxn;
    this.interpreter.runtime.ctx.gtxs = [this.interpreter.subTxn];
    this.interpreter.runtime.ctx.isInnerTx = true;
    this.interpreter.runtime.ctx.processTransactions([execParams]);

    // update current txns to base (top-level) after innerTx execution
    this.interpreter.runtime.ctx.tx = baseCurrTx;
    this.interpreter.runtime.ctx.gtxs = baseCurrTxGrp;

    // save executed tx, reset current tx
    this.interpreter.runtime.ctx.isInnerTx = false;
    this.interpreter.innerTxns.push(this.interpreter.subTxn);
    this.interpreter.subTxn = undefined;
  }
}

// push field F of the last inner transaction to stack
// push to stack [...stack, transaction field]
export class ITxn extends Op {
  readonly field: string;
  readonly idx: number | undefined;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Set transaction field according to arguments passed
   * @param args Expected arguments: [transaction field]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    this.idx = undefined;

    this.assertITxFieldDefined(args[0], interpreter.tealVersion, line);
    if (TxArrFields[interpreter.tealVersion].has(args[0])) { // eg. itxn Accounts 1
      assertLen(args.length, 2, line);
      assertOnlyDigits(args[1], line);
      this.idx = Number(args[1]);
    } else {
      assertLen(args.length, 1, line);
    }
    this.assertITxFieldDefined(args[0], interpreter.tealVersion, line);

    this.field = args[0]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    if (this.interpreter.innerTxns.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.NO_INNER_TRANSACTION_AVAILABLE,
        { version: this.interpreter.tealVersion, line: this.line });
    }

    let result;
    const tx = this.interpreter.innerTxns[this.interpreter.innerTxns.length - 1];

    switch (this.field) {
      case 'Logs': {
        // TODO handle this after log opcode is implemented
        // https://www.pivotaltracker.com/story/show/179855820
        result = 0n;
        break;
      }
      case 'NumLogs': {
        // TODO handle this after log opcode is implemented
        result = 0n;
        break;
      }
      case 'CreatedAssetID': {
        result = BigInt(this.interpreter.runtime.ctx.createdAssetID);
        break;
      }
      case 'CreatedApplicationID': {
        result = 0n; // can we create an app in inner-tx?
        break;
      }
      default: {
        // similarly as Txn Op
        if (this.idx !== undefined) { // if field is an array use txAppArg (with "Accounts"/"ApplicationArgs"/'Assets'..)
          result = txAppArg(this.field, tx, this.idx, this,
            this.interpreter.tealVersion, this.line);
        } else {
          result = txnSpecbyField(this.field, tx, [tx], this.interpreter.tealVersion);
        }

        break;
      }
    }

    stack.push(result);
  }
}

export class ITxna extends Op {
  readonly field: string;
  readonly idx: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets `field` and `idx` values according to arguments passed.
   * @param args Expected arguments: [transaction field, transaction field array index]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 2, line);
    assertOnlyDigits(args[1], line);
    this.assertITxArrFieldDefined(args[0], interpreter.tealVersion, line);

    this.field = args[0]; // field
    this.idx = Number(args[1]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    if (this.interpreter.innerTxns.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.NO_INNER_TRANSACTION_AVAILABLE,
        { version: this.interpreter.tealVersion, line: this.line });
    }

    const tx = this.interpreter.innerTxns[this.interpreter.innerTxns.length - 1];
    const result = txAppArg(this.field, tx, this.idx, this,
      this.interpreter.tealVersion, this.line);
    stack.push(result);
  }
}

/**
 * txnas F:
 * push Xth value of the array field F of the current transaction
 * pops from stack: [...stack, uint64]
 * pushes to stack: [...stack, transaction field]
 */
export class Txnas extends Txna {
  /**
   * Sets `field`, `txIdx` values according to arguments passed.
   * @param args Expected arguments: [transaction field]
   *   Note: Transaction field is expected as string instead of number.
   *   For ex: `"Fee"` rather than `0`.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    assertLen(args.length, 1, line);
    // NOTE: txField will be updated in execute.
    super([...args, mockTxField], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const top = this.assertBigInt(stack.pop(), this.line);
    this.idx = Number(top);
    super.execute(stack);
  }
}

/**
 * gtxnas T F:
 * push Xth value of the array field F from the Tth transaction in the current group
 * pops from stack: [...stack, uint64]
 * push to stack [...stack, value of field]
 */
export class Gtxnas extends Gtxna {
  /**
   * Sets `field`(Transaction Field) and
   * `txIdx`(Transaction Group Index) values according to arguments passed.
   * @param args Expected arguments: [transaction group index, transaction field]
   *   Note: Transaction field is expected as string instead of number.
   *   For ex: `"Fee"` rather than `0`.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    assertLen(args.length, 2, line);
    // NOTE: txFieldIdx will be updated in execute.
    super([...args, mockTxFieldIdx], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const top = this.assertBigInt(stack.pop(), this.line);
    this.idx = Number(top);
    super.execute(stack);
  }
}

/**
 * gtxnsas F:
 * pop an index A and an index B. push Bth value of the array
 * field F from the Ath transaction in the current group
 * pops from stack: [...stack, {uint64 A}, {uint64 B}]
 * push to stack [...stack, value of field]
 */
export class Gtxnsas extends Gtxna {
  /**
   * Sets `field`(Transaction Field)
   * @param args Expected arguments: [transaction field]
   *   Note: Transaction field is expected as string instead of number.
   *   For ex: `"Fee"` rather than `0`.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    assertLen(args.length, 1, line);
    // NOTE: txIdx and TxFieldIdx will be updated in execute.
    super([mockTxIdx, args[0], mockTxFieldIdx], line, interpreter);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2, this.line);
    const arrFieldIdx = this.assertBigInt(stack.pop(), this.line);
    const txIdxInGrp = this.assertBigInt(stack.pop(), this.line);
    this.idx = Number(arrFieldIdx);
    this.txIdx = Number(txIdxInGrp);
    super.execute(stack);
  }
}

// pushes Arg[N] from LogicSig argument array to stack
// Pops: ... stack, uint64
// push to stack [...stack, bytes]
export class Args extends Arg {
  /**
   * Gets the argument value from interpreter.args array.
   * store the value in _arg variable
   * @param args Expected arguments: none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super([...args, "100"], line, interpreter);
    assertLen(args.length, 0, line);
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const top = this.assertBigInt(stack.pop(), this.line);
    this.index = Number(top);
    super.execute(stack);
  }
}

// Write bytes to log state of the current application
// pops to stack [...stack, bytes]
// Pushes: None
export class Log extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    this.interpreter = interpreter;
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    const logByte = this.assertBytes(stack.pop(), this.line);
    const txID = this.interpreter.runtime.ctx.tx.txID;
    const txReceipt = this.interpreter.runtime.ctx.state.txReceipts.get(txID);
    if (txReceipt.logs === undefined) { txReceipt.logs = []; }

    // max no. of logs exceeded
    if (txReceipt.logs.length === ALGORAND_MAX_LOGS_COUNT) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.LOGS_COUNT_EXCEEDED_THRESHOLD, {
          maxLogs: ALGORAND_MAX_LOGS_COUNT,
          line: this.line
        }
      );
    }

    // max "length" of logs exceeded
    const length = txReceipt.logs.join("").length + logByte.length;
    if (length > ALGORAND_MAX_LOGS_LENGTH) {
      throw new RuntimeError(
        RUNTIME_ERRORS.TEAL.LOGS_LENGTH_EXCEEDED_THRESHOLD, {
          maxLength: ALGORAND_MAX_LOGS_LENGTH,
          origLength: length,
          line: this.line
        }
      );
    }

    txReceipt.logs.push(convertToString(logByte));
  }
}

// bitlen interprets arrays as big-endian integers, unlike setbit/getbit
// stack = [..., any]
// push to stack = [..., bitlen]
export class BitLen extends Op {
  readonly line: number;

  /**
   * Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
  */
  constructor (args: string[], line: number) {
    super();
    this.line = line;
    assertLen(args.length, 0, line);
  };

  execute (stack: Stack<StackElem>): void {
    this.assertMinStackLen(stack, 1, this.line);
    const value = stack.pop();

    let bitlen = 0;

    if (typeof value === "bigint") {
      bitlen = (value === 0n) ? 0 : value.toString(2).length;
    } else {
      // value is Uint8 => one element have 8 bits.
      // => bitlen = 8 * value.length - 1 + bitlen(first element)
      if (value.length > 0) {
        bitlen = (value.length - 1) * 8;
        bitlen += value[0].toString(2).length;
      }
    }

    stack.push(BigInt(bitlen));
  }
}

// get App Params Information
// push to stack [...stack, value(bigint/bytes), did_exist]
// NOTE: if app doesn't exist, then did_exist = 0, value = 0
export class AppParamsGet extends Op {
  readonly interpreter: Interpreter;
  readonly line: number;
  readonly field: string;
  /**
   * Asserts 1 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    this.interpreter = interpreter;
    assertLen(args.length, 1, line);

    if (!AppParamDefined[interpreter.tealVersion].has(args[0])) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_APP_FIELD, {
        field: args[0],
        line: line,
        tealV: interpreter.tealVersion
      });
    }

    this.field = args[0];
  }

  execute (stack: Stack<StackElem>): void {
    this.assertMinStackLen(stack, 1, this.line);

    const appID = this.assertBigInt(stack.pop(), this.line);

    if (this.interpreter.runtime.ctx.state.globalApps.has(Number(appID))) {
      let value: StackElem = 0n;
      const appDef = this.interpreter.getApp(Number(appID), this.line);
      switch (this.field) {
        case "AppApprovalProgram":
          value = parsing.stringToBytes(appDef["approval-program"]);
          break;
        case "AppClearStateProgram":
          value = parsing.stringToBytes(appDef["clear-state-program"]);
          break;
        case "AppGlobalNumUint":
          value = BigInt(appDef["global-state-schema"].numUint);
          break;
        case "AppGlobalNumByteSlice":
          value = BigInt(appDef["global-state-schema"].numByteSlice);
          break;
        case "AppLocalNumUint":
          value = BigInt(appDef["local-state-schema"].numUint);
          break;
        case "AppLocalNumByteSlice":
          value = BigInt(appDef["local-state-schema"].numByteSlice);
          break;
        case "AppExtraProgramPages":
          // only return default number extra program pages in runtime
          // should fix it in future.
          value = 1n;
          break;
        case "AppCreator":
          value = decodeAddress(appDef.creator).publicKey;
          break;
        case "AppAddress":
          value = decodeAddress(getApplicationAddress(appID)).publicKey;
      };

      stack.push(value);
      stack.push(1n);
    } else {
      stack.push(0n);
      stack.push(0n);
    }
  };
};
