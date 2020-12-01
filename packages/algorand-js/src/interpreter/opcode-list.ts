/* eslint sonarjs/no-identical-functions: 0 */
import { Message, sha256 } from "js-sha256";
import { sha512_256 } from "js-sha512";
import { decode, encode } from "uint64be";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { MAX_CONCAT_SIZE, MAX_UINT64 } from "../lib/constants";
import { compareArray } from "../lib/helpers";
import type { TEALStack } from "../types";
import { Interpreter } from "./interpreter";
import { Op } from "./opcode";

const BIGINT0 = BigInt("0");
const BIGINT1 = BigInt("1");
// pops string([]byte) from stack and pushes it's length to stack
export class Len extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    const a = this.assertBytes(stack.pop());
    stack.push(BigInt(a.length));
  }
}

// pops two unit64 from stack(a, b) and pushes their sum(a + b) to stack
// panics on overflow (result > max_unit64)
export class Add extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    const result = a + b;
    this.checkOverflow(result);
    stack.push(result);
  }
}

// pops two unit64 from stack(a, b) and pushes their diff(a - b) to stack
// panics on underflow (result < 0)
export class Sub extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    const result = a - b;
    this.checkUnderflow(result);
    stack.push(result);
  }
}

// pops two unit64 from stack(a, b) and pushes their division(a / b) to stack
// panics if b == 0
export class Div extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (b === BIGINT0) {
      throw new TealError(ERRORS.TEAL.ZERO_DIV);
    }
    stack.push(a / b);
  }
}

// pops two unit64 from stack(a, b) and pushes their mult(a * b) to stack
// panics on overflow (result > max_unit64)
export class Mul extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    const result = a * b;
    this.checkOverflow(result);
    stack.push(result);
  }
}

// pushes argument[N] from argument array to stack
export class Arg extends Op {
  readonly _arg;

  constructor (arg: Uint8Array) {
    super();
    this._arg = arg;
  };

  execute (stack: TEALStack): void {
    const a = this.assertBytes(this._arg);
    stack.push(a);
  }
}

// load block of byte-array constants
export class Bytecblock extends Op {
  readonly bytecblock: Uint8Array[];
  readonly interpreter: Interpreter;

  constructor (interpreter: Interpreter, bytecblock: Uint8Array[]) {
    super();
    this.interpreter = interpreter;
    this.bytecblock = bytecblock;
  }

  execute (stack: TEALStack): void {
    this.assertArrLength(this.bytecblock);
    this.interpreter.bytecblock = this.bytecblock;
  }
}

// push bytes constant from bytecblock to stack by index
export class Bytec extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  constructor (idx: number, interpreter: Interpreter) {
    super();
    this.index = idx;
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.bytecblock);
    const bytec = this.assertBytes(this.interpreter.bytecblock[this.index]);
    stack.push(bytec);
  }
}

// load block of uint64 constants
export class Intcblock extends Op {
  readonly intcblock: Array<bigint>;
  readonly interpreter: Interpreter;

  constructor (interpreter: Interpreter, intcblock: Array<bigint>) {
    super();
    this.interpreter = interpreter;
    this.intcblock = intcblock;
  }

  execute (stack: TEALStack): void {
    this.assertArrLength(this.intcblock);
    this.interpreter.intcblock = this.intcblock;
  }
}

// push value from uint64 intcblock to stack by index
export class Intc extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  constructor (index: number, interpreter: Interpreter) {
    super();
    this.index = index;
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.intcblock);
    const intc = this.assertBigInt(this.interpreter.intcblock[this.index]);
    stack.push(intc);
  }
}

// pops two unit64 from stack(a, b) and pushes their modulo(a % b) to stack
// Panic if B == 0.
export class Mod extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (b === BIGINT0) {
      throw new TealError(ERRORS.TEAL.ZERO_DIV);
    }
    stack.push(a % b);
  }
}

// pops two unit64 from stack(a, b) and pushes their bitwise-or(a | b) to stack
export class BitwiseOr extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    stack.push(a | b);
  }
}

// pops two unit64 from stack(a, b) and pushes their bitwise-and(a & b) to stack
export class BitwiseAnd extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    stack.push(a & b);
  }
}

// pops two unit64 from stack(a, b) and pushes their bitwise-xor(a ^ b) to stack
export class BitwiseXor extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    stack.push(a ^ b);
  }
}

// pop unit64 from stack and push it's bitwise-invert(~a) to stack
export class BitwiseNot extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    const a = this.assertBigInt(stack.pop());
    stack.push(~a);
  }
}

// pop a value from the stack and store to scratch space
export class Store extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  constructor (index: number, interpreter: Interpreter) {
    super();
    this.index = index;
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.scratch);
    this.assertStackLen(stack, 1);
    const top = stack.pop();
    this.interpreter.scratch[this.index] = top;
  }
}

// copy a value from scratch space to the stack
export class Load extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  constructor (index: number, interpreter: Interpreter) {
    super();
    this.index = index;
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.scratch);
    stack.push(this.interpreter.scratch[this.index]);
  }
}

// err opcode : Error. Panic immediately.
export class Err extends Op {
  execute (stack: TEALStack): void {
    throw new TealError(ERRORS.TEAL.TEAL_ENCOUNTERED_ERR);
  }
}

// SHA256 hash of value X, yields [32]byte
export class Sha256 extends Op {
  execute (stack: TEALStack): void {
    const hash = sha256.create();
    const val = this.assertBytes(stack.pop()) as Message;
    hash.update(val);
    const hashedOutput = Buffer.from(hash.hex(), 'hex');
    var arrByte = Uint8Array.from(hashedOutput);
    stack.push(arrByte);
  }
}

// SHA512_256 hash of value X, yields [32]byte
export class Sha512_256 extends Op {
  execute (stack: TEALStack): void {
    const hash = sha512_256.create();
    const val = this.assertBytes(stack.pop()) as Message;
    hash.update(val);
    const hashedOutput = Buffer.from(hash.hex(), 'hex');
    var arrByte = Uint8Array.from(hashedOutput);
    stack.push(arrByte);
  }
}

// If A < B pushes '1' else '0'
export class LessThan extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (a < b) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A > B pushes '1' else '0'
export class GreaterThan extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (a > b) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A <= B pushes '1' else '0'
export class LessThanEqualTo extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (a <= b) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A >= B pushes '1' else '0'
export class GreaterThanEqualTo extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (a >= b) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A && B is true pushes '1' else '0'
export class And extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (a && b) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A || B is true pushes '1' else '0'
export class Or extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    if (a || b) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A == B pushes '1' else '0'
export class EqualTo extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = stack.pop();
    const b = stack.pop();
    if (typeof a === typeof b) {
      if (typeof a === "bigint") {
        if (a === b) {
          stack.push(BIGINT1);
        } else {
          stack.push(BIGINT0);
        }
      } else {
        if (compareArray(this.assertBytes(a), this.assertBytes(b))) {
          stack.push(BIGINT1);
        } else {
          stack.push(BIGINT0);
        }
      }
    } else {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE);
    }
  }
}

// If A != B pushes '1' else '0'
export class NotEqualTo extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = stack.pop();
    const b = stack.pop();
    if (typeof a === typeof b) {
      if (typeof a === "bigint") {
        if (a === b) {
          stack.push(BIGINT0);
        } else {
          stack.push(BIGINT1);
        }
      } else {
        if (compareArray(this.assertBytes(a), this.assertBytes(b))) {
          stack.push(BIGINT0);
        } else {
          stack.push(BIGINT1);
        }
      }
    } else {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE);
    }
  }
}

// X == 0 yields 1; else 0
export class Not extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    const a = this.assertBigInt(stack.pop());
    if (a === BIGINT0) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// converts uint64 X to big endian bytes
export class Itob extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    const stackValue = this.assertBigInt(stack.pop());
    const buf = encode(Number(stackValue));
    const uint8arr = new Uint8Array(buf);
    stack.push(uint8arr);
  }
}

// converts bytes X as big endian to uint64
// btoi panics if the input is longer than 8 bytes.
export class Btoi extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    const bytes = this.assertBytes(stack.pop());
    if (bytes.length > 8) {
      throw new TealError(ERRORS.TEAL.LONG_INPUT_ERROR);
    }
    const buf = Buffer.from(bytes);
    const uintValue = decode(buf) as bigint;
    stack.push(uintValue);
  }
}

// A plus B out to 128-bit long result as sum (top) and carry-bit uint64 values on the stack
export class Addw extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const valueA = this.assertBigInt(stack.pop());
    const valueB = this.assertBigInt(stack.pop());
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

// Pop one element from stack
export class Pop extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    stack.pop();
  }
}

// duplicate last value on stack
export class Dup extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    const lastValue = stack.pop();

    stack.push(lastValue);
    stack.push(lastValue);
  }
}

// duplicate two last values on stack: A, B -> A, B, A, B
export class Dup2 extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
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
export class Concat extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const valueB = this.assertBytes(stack.pop());
    const valueA = this.assertBytes(stack.pop());

    if (valueA.length + valueB.length > MAX_CONCAT_SIZE) {
      throw new TealError(ERRORS.TEAL.CONCAT_ERROR);
    }
    var c = new Uint8Array(valueB.length + valueA.length);
    c.set(valueB);
    c.set(valueA, valueB.length);
    stack.push(c);
  }
}

// pop a byte string X. For immediate values in 0..255 M and N:
// extract a range of bytes from it starting at M up to but not including N,
// push the substring result. If N < M, or either is larger than the string length,
// the program fails
export class Substring extends Op {
  execute (stack: TEALStack): void {
    // const byteString = stack.pop();
  }
}

// pop a byte string A and two integers B and C.
// Extract a range of bytes from A starting at B up to
// but not including C, push the substring result. If C < B,
// or either is larger than the string length, the program fails
export class Substring3 extends Op {
  execute (stack: TEALStack): void {
    const byteString = this.assertBytes(stack.pop());
    const start = this.assertBigInt(stack.pop());
    const end = this.assertBigInt(stack.pop());

    if (end < start) {
      throw new TealError(ERRORS.TEAL.SUBSTRING_END_BEFORE_START);
    }
    if (start > byteString.length || end > byteString.length) {
      throw new TealError(ERRORS.TEAL.SUBSTRING_RANGE_BEYOND);
    }

    stack.push(byteString.slice(Number(start), Number(end)));
  }
}
