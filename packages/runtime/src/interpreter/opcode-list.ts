/* eslint sonarjs/no-identical-functions: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */
import { AssetDef, decodeAddress, encodeAddress, isValidAddress, verifyBytes } from "algosdk";
import { Message, sha256 } from "js-sha256";
import { sha512_256 } from "js-sha512";
import { Keccak } from 'sha3';

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { compareArray } from "../lib/compare";
import { AssetParamMap, GlobalFields, MAX_CONCAT_SIZE, MAX_UINT64 } from "../lib/constants";
import {
  assertLen, assertOnlyDigits, convertToBuffer,
  convertToString, getEncoding, stringToBytes
} from "../lib/parsing";
import { txAppArg, txnSpecbyField } from "../lib/txn";
import { EncodingType, StackElem, TEALStack, TxnOnComplete, TxnType } from "../types";
import { Interpreter } from "./interpreter";
import { Op } from "./opcode";

export const BIGINT0 = BigInt("0");
export const BIGINT1 = BigInt("1");

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
    if (args[0] === "version" && (args[1] === '1' || args[1] === '2')) {
      this.version = Number(args[1]);
      interpreter.tealVersion = this.version;
    } else {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.PRAGMA_VERSION_ERROR, { got: args.join(' '), line: line });
    }
  }

  // Returns Pragma version
  getVersion (): number {
    return this.version;
  }

  execute (stack: TEALStack): void {}
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
    this.checkOverflow(result, this.line);
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
    if (last === BIGINT0) {
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
    this.checkOverflow(result, this.line);
    stack.push(result);
  }
}

// pushes argument[N] from argument array to stack
// push to stack [...stack, bytes]
export class Arg extends Op {
  readonly _arg: Uint8Array;
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

    const index = Number(args[0]);
    this.checkIndexBound(index, interpreter.runtime.ctx.args, this.line);

    this._arg = interpreter.runtime.ctx.args[index];
  }

  execute (stack: TEALStack): void {
    const last = this.assertBytes(this._arg, this.line);
    stack.push(last);
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
      bytecblock.push(stringToBytes(val));
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
    if (last === BIGINT0) {
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

// copy last value from scratch space to the stack
// push to stack [...stack, bigint/bytes]
export class Load extends Op {
  readonly index: number;
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
    var arrByte = Uint8Array.from(hashedOutput);
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
    var arrByte = Uint8Array.from(hashedOutput);
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
    var arrByte = Uint8Array.from(hash.digest());
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
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, { line: this.line });
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
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.INVALID_TYPE, { line: this.line });
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
    if (last === BIGINT0) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
    const stackValue = this.assertBigInt(stack.pop(), this.line);
    const buff = Buffer.alloc(8);
    buff.writeBigUInt64BE(stackValue);
    stack.push(Uint8Array.from(buff));
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
    if (bytes.length > 8) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.LONG_INPUT_ERROR, { line: this.line });
    }
    const uint64 = Buffer.from(bytes).readBigUInt64BE();
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
      stack.push(BIGINT1);
      stack.push(valueC - BIGINT1);
    } else {
      stack.push(BIGINT0);
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
    this.checkOverflow(low, this.line);

    const high = result >> BigInt('64');
    this.checkOverflow(high, this.line);

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
    const valueB = this.assertBytes(stack.pop(), this.line);
    const valueA = this.assertBytes(stack.pop(), this.line);

    if (valueA.length + valueB.length > MAX_CONCAT_SIZE) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.CONCAT_ERROR, { line: this.line });
    }
    var c = new Uint8Array(valueB.length + valueA.length);
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
    const byteString = this.assertBytes(stack.pop(), this.line);
    const start = this.assertUint8(this.start, this.line);
    const end = this.assertUint8(this.end, this.line);

    const subString = this.subString(start, end, byteString, this.line);
    stack.push(subString);
  }
}

// pop last byte string A and two integers B and C.
// Extract last range of bytes from A starting at B up to
// but not including C, push the substring result. If C < B,
// or either is larger than the string length, the program fails
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
    const byteString = this.assertBytes(stack.pop(), this.line);
    const end = this.assertBigInt(stack.pop(), this.line);
    const start = this.assertBigInt(stack.pop(), this.line);

    const subString = this.subString(start, end, byteString, this.line);
    stack.push(subString);
  }
}

// push field from current transaction to stack
// push to stack [...stack, transaction field]
export class Txn extends Op {
  readonly field: string;
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
    assertLen(args.length, 1, line);
    this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);

    this.field = args[0]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    const result = txnSpecbyField(
      this.field,
      this.interpreter.runtime.ctx.tx,
      this.interpreter.runtime.ctx.gtxs,
      this.interpreter.tealVersion);
    stack.push(result);
  }
}

// push field to the stack from a transaction in the current transaction group
// If this transaction is i in the group, gtxn i field is equivalent to txn field.
// push to stack [...stack, transaction field]
export class Gtxn extends Op {
  readonly field: string;
  readonly txIdx: number;
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets `field`, `txIdx` values according to arguments passed.
   * @param args Expected argumensts: [transaction group index, transaction field]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    this.line = line;
    assertLen(args.length, 2, line);
    assertOnlyDigits(args[0], line);
    this.assertTxFieldDefined(args[1], interpreter.tealVersion, line);

    this.txIdx = Number(args[0]); // transaction group index
    this.field = args[1]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertUint8(BigInt(this.txIdx), this.line);
    this.checkIndexBound(this.txIdx, this.interpreter.runtime.ctx.gtxs, this.line);

    const result = txnSpecbyField(
      this.field,
      this.interpreter.runtime.ctx.gtxs[this.txIdx],
      this.interpreter.runtime.ctx.gtxs,
      this.interpreter.tealVersion);
    stack.push(result);
  }
}

// push value of an array field from current transaction to stack
// push to stack [...stack, value of an array field ]
export class Txna extends Op {
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
    this.assertTxFieldDefined(args[0], interpreter.tealVersion, line);

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

// push value of a field to the stack from a transaction in the current transaction group
// push to stack [...stack, value of field]
export class Gtxna extends Op {
  readonly field: string;
  readonly txIdx: number; // transaction group index
  readonly idx: number; // array index
  readonly interpreter: Interpreter;
  readonly line: number;

  /**
   * Sets `field`(Transaction Field), `idx`(Array Index) and
   * `txIdx`(Transaction Group Index) values according to arguments passed.
   * @param args Expected arguments:
   * [transaction group index, transaction field, transaction field array index]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 3, line);
    assertOnlyDigits(args[0], line);
    assertOnlyDigits(args[2], line);
    this.assertTxFieldDefined(args[1], interpreter.tealVersion, line);

    this.txIdx = Number(args[0]); // transaction group index
    this.field = args[1]; // field
    this.idx = Number(args[2]); // transaction field array index
    this.interpreter = interpreter;
    this.line = line;
  }

  execute (stack: TEALStack): void {
    this.assertUint8(BigInt(this.txIdx), this.line);

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

  execute (stack: TEALStack): void {}
}

// branch unconditionally to label
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

// branch conditionally if top of stack is zero
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

    if (last === BIGINT0) {
      this.interpreter.jumpForward(this.label, this.line);
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

    if (last !== BIGINT0) {
      this.interpreter.jumpForward(this.label, this.line);
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
          result,
          this.interpreter.getApp(result, this.line),
          this.line);
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
    const appId = this.assertBigInt(stack.pop(), this.line);
    const accountIndex = this.assertBigInt(stack.pop(), this.line);

    const account = this.interpreter.getAccount(accountIndex, this.line);
    const localState = account.appsLocalState;

    const isOptedIn = localState.get(Number(appId));
    if (isOptedIn) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
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
    const accountIndex = this.assertBigInt(stack.pop(), this.line);

    const account = this.interpreter.getAccount(accountIndex, this.line);
    const appId = this.interpreter.runtime.ctx.tx.apid || 0;

    const val = account.getLocalState(appId, key);
    if (val) {
      stack.push(val);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
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
    const appId = this.assertBigInt(stack.pop(), this.line);
    const accountIndex = this.assertBigInt(stack.pop(), this.line);

    const account = this.interpreter.getAccount(accountIndex, this.line);
    const val = account.getLocalState(Number(appId), key);
    if (val) {
      stack.push(val);
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
      stack.push(BIGINT0); // did_exist_flag
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

    const appId = this.interpreter.runtime.ctx.tx.apid || 0;
    const val = this.interpreter.getGlobalState(appId, key, this.line);
    if (val) {
      stack.push(val);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
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
    let appIndex = this.assertBigInt(stack.pop(), this.line);

    const foreignApps = this.interpreter.runtime.ctx.tx.apfa;
    let appId;
    if (appIndex === BIGINT0) {
      appId = this.interpreter.runtime.ctx.tx.apid; // zero index means current app
    } else {
      this.checkIndexBound(Number(--appIndex), foreignApps, this.line);
      appId = foreignApps[Number(appIndex)];
    }

    const val = this.interpreter.getGlobalState(appId, key, this.line);
    if (val) {
      stack.push(val);
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
      stack.push(BIGINT0); // did_exist_flag
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
    const accountIndex = this.assertBigInt(stack.pop(), this.line);

    const account = this.interpreter.getAccount(accountIndex, this.line);
    const appId = this.interpreter.runtime.ctx.tx.apid || 0;

    // get updated local state for account
    const localState = account.setLocalState(appId, key, value, this.line);
    const acc = this.interpreter.runtime.assertAccountDefined(account.address,
      this.interpreter.runtime.ctx.state.accounts.get(account.address), this.line);
    acc.appsLocalState.set(appId, localState);
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

    const appId = this.interpreter.runtime.ctx.tx.apid || 0; // if undefined use 0 as default
    this.interpreter.setGlobalState(appId, key, value, this.line);
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
    const accountIndex = this.assertBigInt(stack.pop(), this.line);

    const appId = this.interpreter.runtime.ctx.tx.apid || 0;
    const account = this.interpreter.getAccount(accountIndex, this.line);

    const localState = account.appsLocalState.get(appId);
    if (localState) {
      localState["key-value"].delete(key.toString()); // delete from local state

      let acc = this.interpreter.runtime.ctx.state.accounts.get(account.address);
      acc = this.interpreter.runtime.assertAccountDefined(account.address, acc, this.line);
      acc.appsLocalState.set(appId, localState);
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

    const appId = this.interpreter.runtime.ctx.tx.apid || 0;

    const app = this.interpreter.getApp(appId, this.line);
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
    const accountIndex = this.assertBigInt(stack.pop(), this.line);
    const acc = this.interpreter.getAccount(accountIndex, this.line);

    stack.push(BigInt(acc.balance()));
  }
}

// For Account A, Asset B (txn.accounts[A]) pushes to the
// push to stack [...stack, 0] if account has no B holding,
// otherwise [...stack, bigint/bytes, 1]
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
    const assetId = this.assertBigInt(stack.pop(), this.line);
    const accountIndex = this.assertBigInt(stack.pop(), this.line);

    const account = this.interpreter.getAccount(accountIndex, this.line);
    const assetInfo = account.assets.get(Number(assetId));
    if (assetInfo === undefined) {
      stack.push(BigInt("0"));
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
    stack.push(BigInt("1"));
  }
}

// get Asset Params Info for given account
// For Index in ForeignAssets array
// push to stack [...stack, 0] if asset doesn't exist,
// otherwise push to stack [...stack, bigint/bytes, 1]
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
    if (AssetParamMap[args[0]] === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.UNKNOWN_ASSET_FIELD, { field: args[0], line: line });
    }

    this.field = args[0];
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1, this.line);
    let foreignAssetsIdx = this.assertBigInt(stack.pop(), this.line);
    this.checkIndexBound(Number(--foreignAssetsIdx), this.interpreter.runtime.ctx.tx.apas, this.line);

    const assetId = this.interpreter.runtime.ctx.tx.apas[Number(foreignAssetsIdx)];
    const AssetDefinition = this.interpreter.getAssetDef(assetId);

    if (AssetDefinition === undefined) {
      stack.push(BigInt("0"));
    } else {
      let value: StackElem;
      const s = AssetParamMap[this.field] as keyof AssetDef;

      switch (this.field) {
        case "AssetTotal":
          value = BigInt(AssetDefinition.total);
          break;
        case "AssetDecimals":
          value = BigInt(AssetDefinition.decimals);
          break;
        case "AssetDefaultFrozen":
          value = AssetDefinition["default-frozen"] ? 1n : 0n;
          break;
        default:
          value = stringToBytes(AssetDefinition[s] as string);
          break;
      }

      stack.push(value);
      stack.push(BigInt("1"));
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
    const intConst = TxnOnComplete[args[0] as keyof typeof TxnOnComplete] ||
      TxnType[args[0] as keyof typeof TxnType];

    // check if string is keyof TxnOnComplete or TxnType
    if (intConst !== undefined) {
      uint64 = BigInt(intConst);
    } else {
      assertOnlyDigits(args[0], line);
      uint64 = BigInt(args[0]);
    }

    this.checkOverflow(uint64, line);
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
