/* eslint sonarjs/no-identical-functions: 0 */
import { decodeAddress, encodeAddress, verifyBytes } from "algosdk";
import { Message, sha256 } from "js-sha256";
import { sha512_256 } from "js-sha512";
import { Keccak } from 'sha3';
import { decode, encode } from "uint64be";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { MAX_CONCAT_SIZE, MAX_UINT64 } from "../lib/constants";
import { compareArray } from "../lib/helpers";
import { convertToBuffer, convertToString } from "../lib/parse-data";
import type { TEALStack } from "../types";
import { EncodingType } from "../types";
import { Interpreter } from "./interpreter";
import { Op } from "./opcode";

const BIGINT0 = BigInt("0");
const BIGINT1 = BigInt("1");
// pops string([]byte) from stack and pushes it's length to stack
export class Len extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const last = this.assertBytes(stack.pop());
    stack.push(BigInt(last.length));
  }
}

// pops two unit64 from stack(last, prev) and pushes their sum(last + prev) to stack
// panics on overflow (result > max_unit64)
export class Add extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    const result = prev + last;
    this.checkOverflow(result);
    stack.push(result);
  }
}

// pops two unit64 from stack(last, prev) and pushes their diff(last - prev) to stack
// panics on underflow (result < 0)
export class Sub extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    const result = prev - last;
    this.checkUnderflow(result);
    stack.push(result);
  }
}

// pops two unit64 from stack(last, prev) and pushes their division(last / prev) to stack
// panics if prev == 0
export class Div extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (last === BIGINT0) {
      throw new TealError(ERRORS.TEAL.ZERO_DIV);
    }
    stack.push(prev / last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their mult(last * prev) to stack
// panics on overflow (result > max_unit64)
export class Mul extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    const result = prev * last;
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
    const last = this.assertBytes(this._arg);
    stack.push(last);
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

// pops two unit64 from stack(last, prev) and pushes their modulo(last % prev) to stack
// Panic if B == 0.
export class Mod extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (last === BIGINT0) {
      throw new TealError(ERRORS.TEAL.ZERO_DIV);
    }
    stack.push(prev % last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-or(last | prev) to stack
export class BitwiseOr extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    stack.push(prev | last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-and(last & prev) to stack
export class BitwiseAnd extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    stack.push(prev & last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-xor(last ^ prev) to stack
export class BitwiseXor extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    stack.push(prev ^ last);
  }
}

// pop unit64 from stack and push it's bitwise-invert(~last) to stack
export class BitwiseNot extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const last = this.assertBigInt(stack.pop());
    stack.push(~last);
  }
}

// pop last value from the stack and store to scratch space
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
    this.assertMinStackLen(stack, 1);
    const top = stack.pop();
    this.interpreter.scratch[this.index] = top;
  }
}

// copy last value from scratch space to the stack
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
    this.assertMinStackLen(stack, 1);
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
    this.assertMinStackLen(stack, 1);
    const hash = sha512_256.create();
    const val = this.assertBytes(stack.pop()) as Message;
    hash.update(val);
    const hashedOutput = Buffer.from(hash.hex(), 'hex');
    var arrByte = Uint8Array.from(hashedOutput);
    stack.push(arrByte);
  }
}

// Keccak256 hash of value X, yields [32]byte
// https://github.com/phusion/node-sha3#example-2
export class Keccak256 extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const top = this.assertBytes(stack.pop());

    const hash = new Keccak(256);
    hash.update(convertToString(top));
    var arrByte = Uint8Array.from(hash.digest());
    stack.push(arrByte);
  }
}

// for (data A, signature B, pubkey C) verify the signature of
// ("ProgData" || program_hash || data) against the pubkey => {0 or 1}
export class Ed25519verify extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3);
    const pubkey = this.assertBytes(stack.pop());
    const signature = this.assertBytes(stack.pop());
    const data = this.assertBytes(stack.pop());

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
export class LessThan extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (prev < last) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A > B pushes '1' else '0'
export class GreaterThan extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (prev > last) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A <= B pushes '1' else '0'
export class LessThanEqualTo extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (prev <= last) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A >= B pushes '1' else '0'
export class GreaterThanEqualTo extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (prev >= last) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A && B is true pushes '1' else '0'
export class And extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (last && prev) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A || B is true pushes '1' else '0'
export class Or extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    if (prev || last) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// If A == B pushes '1' else '0'
export class EqualTo extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = stack.pop();
    const prev = stack.pop();
    if (typeof last === typeof prev) {
      if (typeof last === "bigint") {
        if (last === prev) {
          stack.push(BIGINT1);
        } else {
          stack.push(BIGINT0);
        }
      } else {
        if (compareArray(this.assertBytes(last), this.assertBytes(prev))) {
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
    this.assertMinStackLen(stack, 2);
    const last = stack.pop();
    const prev = stack.pop();
    if (typeof last === typeof prev) {
      if (typeof last === "bigint") {
        if (last === prev) {
          stack.push(BIGINT0);
        } else {
          stack.push(BIGINT1);
        }
      } else {
        if (compareArray(this.assertBytes(last), this.assertBytes(prev))) {
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
    this.assertMinStackLen(stack, 1);
    const last = this.assertBigInt(stack.pop());
    if (last === BIGINT0) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// converts uint64 X to big endian bytes
export class Itob extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
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
    this.assertMinStackLen(stack, 1);
    const bytes = this.assertBytes(stack.pop());
    if (bytes.length > 8) {
      throw new TealError(ERRORS.TEAL.LONG_INPUT_ERROR);
    }
    const buf = Buffer.from(bytes);
    const uintValue = decode(buf);
    stack.push(BigInt(uintValue));
  }
}

// A plus B out to 128-bit long result as sum (top) and carry-bit uint64 values on the stack
export class Addw extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
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

// A times B out to 128-bit long result as low (top) and high uint64 values on the stack
export class Mulw extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const valueA = this.assertBigInt(stack.pop());
    const valueB = this.assertBigInt(stack.pop());
    const result = valueA * valueB;

    const low = result & MAX_UINT64;
    this.checkOverflow(low);

    const high = result >> BigInt('64');
    this.checkOverflow(high);

    stack.push(high);
    stack.push(low);
  }
}

// Pop one element from stack
export class Pop extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    stack.pop();
  }
}

// duplicate last value on stack
export class Dup extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const lastValue = stack.pop();

    stack.push(lastValue);
    stack.push(lastValue);
  }
}

// duplicate two last values on stack: A, B -> A, B, A, B
export class Dup2 extends Op {
  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
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
    this.assertMinStackLen(stack, 2);
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

// pop last byte string X. For immediate values in 0..255 M and N:
// extract last range of bytes from it starting at M up to but not including N,
// push the substring result. If N < M, or either is larger than the string length,
// the program fails
export class Substring extends Op {
  readonly start: bigint;
  readonly end: bigint;

  constructor (start: bigint, end: bigint) {
    super();
    this.start = start;
    this.end = end;
  }

  execute (stack: TEALStack): void {
    const byteString = this.assertBytes(stack.pop());
    const start = this.assertUint8(this.start);
    const end = this.assertUint8(this.end);

    const subString = this.subString(start, end, byteString);
    stack.push(subString);
  }
}

// pop last byte string A and two integers B and C.
// Extract last range of bytes from A starting at B up to
// but not including C, push the substring result. If C < B,
// or either is larger than the string length, the program fails
export class Substring3 extends Op {
  execute (stack: TEALStack): void {
    const byteString = this.assertBytes(stack.pop());
    const end = this.assertBigInt(stack.pop());
    const start = this.assertBigInt(stack.pop());

    const subString = this.subString(start, end, byteString);
    stack.push(subString);
  }
}

/** Pseudo-Ops **/
// push integer to stack
export class Int extends Op {
  readonly uint64: bigint;

  constructor (uint64: bigint) {
    super();
    this.uint64 = uint64;
  }

  execute (stack: TEALStack): void {
    stack.push(this.uint64);
  }
}

// push bytes to stack
export class Byte extends Op {
  readonly str: string;
  readonly encoding?: EncodingType;

  constructor (str: string, encoding?: EncodingType) {
    super();
    this.str = str;
    if (encoding !== undefined) {
      this.encoding = encoding;
    }
  }

  execute (stack: TEALStack): void {
    const buffer = convertToBuffer(this.str, this.encoding);
    stack.push(new Uint8Array(buffer));
  }
}

// decodes algorand address to bytes and pushes to stack
export class Addr extends Op {
  readonly addr: string;

  constructor (addr: string) {
    super();
    this.addr = addr; // parser should verify the addr first
  }

  execute (stack: TEALStack): void {
    const addr = decodeAddress(this.addr);
    stack.push(addr.publicKey);
  }
}
