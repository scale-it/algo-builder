/* eslint sonarjs/no-identical-functions: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */
import { toBytes } from "algob";
import { decodeAddress, encodeAddress, isValidAddress, verifyBytes } from "algosdk";
import { Message, sha256 } from "js-sha256";
import { sha512_256 } from "js-sha512";
import { Keccak } from 'sha3';
import { decode, encode } from "uint64be";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { compareArray } from "../lib/compare";
import { MAX_CONCAT_SIZE, MAX_UINT64 } from "../lib/constants";
import { assertLen, assertOnlyDigits, convertToBuffer, convertToString, getEncoding } from "../lib/parsing";
import type { EncodingType, TEALStack } from "../types";
import { Interpreter } from "./interpreter";
import { Op } from "./opcode";
import { getGlobalState, getLocalState, updateGlobalState, updateLocalState } from "./stateful";
import { txAppArg, txnSpecbyField } from "./txn";

export const BIGINT0 = BigInt("0");
export const BIGINT1 = BigInt("1");

// Opcodes reference link: https://developer.algorand.org/docs/reference/teal/opcodes/

// Store TEAL version
// [...stack]
export class Pragma extends Op {
  readonly version: bigint;

  /**
   * Description: Store Pragma version
   * @param args Expected arguments: ["version", version number]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 2, line);
    if (args[0] === "version") {
      this.version = BigInt(args[1]);
    } else {
      throw new TealError(ERRORS.TEAL.PRAGMA_VERSION_ERROR, { got: args[0], line: line });
    }
  }

  // Returns Pragma version
  getVersion (): bigint {
    return this.version;
  }

  execute (stack: TEALStack): void {
    throw new TealError(ERRORS.TEAL.TEAL_ENCOUNTERED_ERR);
  }
}

// pops string([]byte) from stack and pushes it's length to stack
// [...stack, bigint]
export class Len extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const last = this.assertBytes(stack.pop());
    stack.push(BigInt(last.length));
  }
}

// pops two unit64 from stack(last, prev) and pushes their sum(last + prev) to stack
// panics on overflow (result > max_unit64)
// [...stack, bigint]
export class Add extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Sub extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Div extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Mul extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bytes]
export class Arg extends Op {
  readonly _arg: Uint8Array;

  /**
   * Description: Gets the argument value from interpreter.args array.
   * store the value in _arg variable
   * @param args Expected arguments: [argument number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    assertOnlyDigits(args[0]);

    const index = Number(args[0]);
    this.checkIndexBound(index, interpreter.args);

    this._arg = interpreter.args[index];
  }

  execute (stack: TEALStack): void {
    const last = this.assertBytes(this._arg);
    stack.push(last);
  }
}

// load block of byte-array constants
// [...stack]
export class Bytecblock extends Op {
  readonly bytecblock: Uint8Array[];
  readonly interpreter: Interpreter;

  /**
   * Description: Store blocks of bytes in bytecblock
   * @param args Expected arguments: [bytecblock] // Ex: ["value1" "value2"]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    const bytecblock: Uint8Array[] = [];
    for (const val of args) {
      bytecblock.push(toBytes(val));
    }

    this.interpreter = interpreter;
    this.bytecblock = bytecblock;
  }

  execute (stack: TEALStack): void {
    this.assertArrLength(this.bytecblock);
    this.interpreter.bytecblock = this.bytecblock;
  }
}

// push bytes constant from bytecblock to stack by index
// [...stack, bytes]
export class Bytec extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  /**
   * Description: Sets index according to arguments passed
   * @param args Expected arguments: [byteblock index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);

    this.index = Number(args[0]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.bytecblock);
    const bytec = this.assertBytes(this.interpreter.bytecblock[this.index]);
    stack.push(bytec);
  }
}

// load block of uint64 constants
// [...stack]
export class Intcblock extends Op {
  readonly intcblock: Array<bigint>;
  readonly interpreter: Interpreter;

  /**
   * Description: Stores block of integer in intcblock
   * @param args Expected arguments: [integer block] // Ex: [100 200]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    const intcblock: Array<bigint> = [];
    for (const val of args) {
      assertOnlyDigits(val);
      intcblock.push(BigInt(val));
    }

    this.interpreter = interpreter;
    this.intcblock = intcblock;
  }

  execute (stack: TEALStack): void {
    this.assertArrLength(this.intcblock);
    this.interpreter.intcblock = this.intcblock;
  }
}

// push value from uint64 intcblock to stack by index
// [...stack, bigint]
export class Intc extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  /**
   * Description: Sets index according to arguments passed
   * @param args Expected arguments: [intcblock index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);

    this.index = Number(args[0]);
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
// [...stack, bigint]
export class Mod extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class BitwiseOr extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    stack.push(prev | last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-and(last & prev) to stack
// [...stack, bigint]
export class BitwiseAnd extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    stack.push(prev & last);
  }
}

// pops two unit64 from stack(last, prev) and pushes their bitwise-xor(last ^ prev) to stack
// [...stack, bigint]
export class BitwiseXor extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = this.assertBigInt(stack.pop());
    const prev = this.assertBigInt(stack.pop());
    stack.push(prev ^ last);
  }
}

// pop unit64 from stack and push it's bitwise-invert(~last) to stack
// [...stack, bigint]
export class BitwiseNot extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const last = this.assertBigInt(stack.pop());
    stack.push(~last);
  }
}

// pop last value from the stack and store to scratch space
// [...stack]
export class Store extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  /**
   * Description: Stores index number according to arguments passed
   * @param args Expected arguments: [index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    assertOnlyDigits(args[0]);

    this.index = Number(args[0]);
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
// [...stack, bigint/bytes]
export class Load extends Op {
  readonly index: number;
  readonly interpreter: Interpreter;

  /**
   * Description: Stores index number according to arguments passed.
   * @param args Expected arguments: [index number]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    assertOnlyDigits(args[0]);

    this.index = Number(args[0]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.checkIndexBound(this.index, this.interpreter.scratch);
    stack.push(this.interpreter.scratch[this.index]);
  }
}

// err opcode : Error. Panic immediately.
// [...stack]
export class Err extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    throw new TealError(ERRORS.TEAL.TEAL_ENCOUNTERED_ERR);
  }
}

// SHA256 hash of value X, yields [32]byte
// [...stack, bytes]
export class Sha256 extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bytes]
export class Sha512_256 extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bytes]
export class Keccak256 extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Ed25519verify extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class LessThan extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class GreaterThan extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class LessThanEqualTo extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class GreaterThanEqualTo extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class And extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Or extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class EqualTo extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = stack.pop();
    const prev = stack.pop();
    if (typeof last !== typeof prev) {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE);
    }
    if (typeof last === "bigint") {
      stack = this.pushBooleanCheck(stack, (last === prev));
    } else {
      stack = this.pushBooleanCheck(stack,
        compareArray(this.assertBytes(last), this.assertBytes(prev)));
    }
  }
}

// If A != B pushes '1' else '0'
// [...stack, bigint]
export class NotEqualTo extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const last = stack.pop();
    const prev = stack.pop();
    if (typeof last !== typeof prev) {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE);
    }
    if (typeof last === "bigint") {
      stack = this.pushBooleanCheck(stack, last !== prev);
    } else {
      stack = this.pushBooleanCheck(stack,
        !compareArray(this.assertBytes(last), this.assertBytes(prev)));
    }
  }
}

// X == 0 yields 1; else 0
// [...stack, bigint]
export class Not extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, big endian bytes]
export class Itob extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Btoi extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Addw extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, bigint]
export class Mulw extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack] // pop value.
export class Pop extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    stack.pop();
  }
}

// duplicate last value on stack
// [...stack, duplicate value]
export class Dup extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const lastValue = stack.pop();

    stack.push(lastValue);
    stack.push(lastValue);
  }
}

// duplicate two last values on stack: A, B -> A, B, A, B
// [...stack, B, A, B, A]
export class Dup2 extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, string]
export class Concat extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

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
// [...stack, substring]
export class Substring extends Op {
  readonly start: bigint;
  readonly end: bigint;

  /**
   * Description: Stores values of `start` and `end` according to arguments passed.
   * @param args Expected arguments: [start index number, end index number]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 2, line);
    assertOnlyDigits(args[0]);
    assertOnlyDigits(args[1]);

    this.start = BigInt(args[0]);
    this.end = BigInt(args[1]);
  };

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
// [...stack, substring]
export class Substring3 extends Op {
  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 0, line);
  };

  execute (stack: TEALStack): void {
    const byteString = this.assertBytes(stack.pop());
    const end = this.assertBigInt(stack.pop());
    const start = this.assertBigInt(stack.pop());

    const subString = this.subString(start, end, byteString);
    stack.push(subString);
  }
}

// push field from current transaction to stack
// [...stack, transaction field]
export class Txn extends Op {
  readonly field: string;
  readonly interpreter: Interpreter;

  /**
   * Description: Set transaction field according to arguments passed
   * @param args Expected arguments: [transaction field]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.assertDefined(args[0]);

    this.field = args[0]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    const r = txnSpecbyField(this.field, this.interpreter);
    stack.push(r);
  }
}

// push field to the stack from a transaction in the current transaction group
// If this transaction is i in the group, gtxn i field is equivalent to txn field.
// [...stack, transaction field]
export class Gtxn extends Op {
  readonly field: string;
  readonly txIdx: number;
  readonly interpreter: Interpreter;

  /**
   * Description: Sets `field`, `txIdx` values according to arguments passed.
   * @param args Expected argumensts: [transaction group index, transaction field]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 2, line);
    assertOnlyDigits(args[0]);
    this.assertDefined(args[1]);

    this.txIdx = Number(args[0]); // transaction group index
    this.field = args[1]; // field
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertUint8(BigInt(this.txIdx));
    this.checkIndexBound(this.txIdx, this.interpreter.gtxs);

    const result = txnSpecbyField(this.field, this.interpreter);
    stack.push(result);
  }
}

// push value of an array field from current transaction to stack
// [...stack, value of an array field ]
export class Txna extends Op {
  readonly field: string;
  readonly idx: number;
  readonly interpreter: Interpreter;

  /**
   * Description: Sets `field` and `idx` values according to arguments passed.
   * @param args Expected arguments: [transaction field, transaction field array index]
   * // Note: Transaction field is expected as string instead of number.
   * For ex: `Fee` is expected and `0` is not expected.
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 2, line);
    assertOnlyDigits(args[1]);
    this.assertDefined(args[0]);

    this.field = args[0]; // field
    this.idx = Number(args[1]);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    const result = txAppArg(this.field, this.interpreter.tx, this.idx, this);
    stack.push(result);
  }
}

// push value of a field to the stack from a transaction in the current transaction group
// [...stack, value of field]
export class Gtxna extends Op {
  readonly field: string;
  readonly txIdx: number; // transaction group index
  readonly idx: number; // array index
  readonly interpreter: Interpreter;

  /**
   * Description: Sets `field`(Transaction Field), `idx`(Array Index) and
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
    assertOnlyDigits(args[0]);
    assertOnlyDigits(args[2]);
    this.assertDefined(args[1]);

    this.txIdx = Number(args[0]); // transaction group index
    this.field = args[1]; // field
    this.idx = Number(args[2]); // transaction field array index
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertUint8(BigInt(this.txIdx));

    const tx = this.interpreter.gtxs[this.txIdx];
    const result = txAppArg(this.field, tx, this.idx, this);
    stack.push(result);
  }
}

// represents branch name of a new branch
// [...stack]
export class Label extends Op {
  readonly label: string;

  /**
   * Description: Sets `label` according to arguments passed.
   * @param args Expected arguments: [label]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0].split(':')[0];
  };

  execute (stack: TEALStack): void {}
}

// branch unconditionally to label
// [...stack]
export class Branch extends Op {
  readonly label: string;
  readonly interpreter: Interpreter;

  /**
   * Description: Sets `label` according to arguments passed.
   * @param args Expected arguments: [label of branch]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0];
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.interpreter.jumpForward(this.label);
  }
}

// branch conditionally if top of stack is zero
// [...stack]
export class BranchIfZero extends Op {
  readonly label: string;
  readonly interpreter: Interpreter;

  /**
   * Description: Sets `label` according to arguments passed.
   * @param args Expected arguments: [label of branch]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0];
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const last = this.assertBigInt(stack.pop());

    if (last === BIGINT0) {
      this.interpreter.jumpForward(this.label);
    }
  }
}

// branch conditionally if top of stack is non zero
// [...stack]
export class BranchIfNotZero extends Op {
  readonly label: string;
  readonly interpreter: Interpreter;

  /**
   * Description: Sets `label` according to arguments passed.
   * @param args Expected arguments: [label of branch]
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 1, line);
    this.label = args[0];
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const last = this.assertBigInt(stack.pop());

    if (last !== BIGINT0) {
      this.interpreter.jumpForward(this.label);
    }
  }
}

// use last value on stack as success value; end
// [...stack, last]
export class Return extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);

    const last = stack.pop();
    while (stack.length()) {
      stack.pop();
    }
    stack.push(last); // use last value as success
    this.interpreter.instructionIndex = this.interpreter.instructions.length; // end execution
  }
}

// check if account specified by Txn.Accounts[A] opted in for the application B => {0 or 1}
// params: account index, application id (top of the stack on opcode entry).
// [...stack, 1] if opted in
// [...stack, 0] 0 otherwise
export class AppOptedIn extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const appId = this.assertBigInt(stack.pop());
    const accountIndex = this.assertBigInt(stack.pop());

    const account = this.getAccount(accountIndex, this.interpreter);
    const localState = account["apps-local-state"];

    const isOptedIn = localState.find(state => state.id === Number(appId));
    if (isOptedIn) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
  }
}

// read from account specified by Txn.Accounts[A] from local state of the current application key B => value
// [...stack]
export class AppLocalGet extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const key = this.assertBytes(stack.pop());
    const accountIndex = this.assertBigInt(stack.pop());

    const account = this.getAccount(accountIndex, this.interpreter);
    const appId = this.interpreter.tx.apid;

    const val = getLocalState(appId, account, key);
    if (val) {
      stack.push(val);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
    }
  }
}

// read from application local state at Txn.Accounts[A] => app B => key C from local state.
// Pushes to the stack [...stack, val, 1] if the key exists,
// otherwise [...stack, 0]
export class AppLocalGetEx extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3);
    const key = this.assertBytes(stack.pop());
    const appId = this.assertBigInt(stack.pop());
    const accountIndex = this.assertBigInt(stack.pop());

    const account = this.getAccount(accountIndex, this.interpreter);
    const val = getLocalState(Number(appId), account, key);
    if (val) {
      stack.push(BIGINT1);
      stack.push(val);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
    }
  }
}

// read key A from global state of a current application => value
// [...stack, 0] if key doesn't exist
// otherwise [...stack, value]
export class AppGlobalGet extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const key = this.assertBytes(stack.pop());

    const appId = this.interpreter.tx.apid;
    const val = getGlobalState(appId, key, this.interpreter);
    if (val) {
      stack.push(val);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
    }
  }
}

// read from application Txn.ForeignApps[A] global state key B pushes to the stack
// [...stack, 0] if key doesn't exist
// otherwise [...stack, value, 1]
// A is specified as an account index in the ForeignApps field of the ApplicationCall transaction,
// zero index means this app
export class AppGlobalGetEx extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const key = this.assertBytes(stack.pop());
    let appIndex = this.assertBigInt(stack.pop());

    const foreignApps = this.interpreter.tx.apfa;
    let appId;
    if (appIndex === BIGINT0) {
      appId = this.interpreter.tx.apid; // zero index means current app
    } else {
      this.checkIndexBound(Number(--appIndex), foreignApps);
      appId = foreignApps[Number(appIndex)];
    }

    const val = getGlobalState(appId, key, this.interpreter);
    if (val) {
      stack.push(BIGINT1);
      stack.push(val);
    } else {
      stack.push(BIGINT0); // The value is zero if the key does not exist.
    }
  }
}

// write to account specified by Txn.Accounts[A] to local state of a current application key B with value C
// [...stack, address]
export class AppLocalPut extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 3);
    const value = stack.pop();
    const key = this.assertBytes(stack.pop());
    const accountIndex = this.assertBigInt(stack.pop());

    const account = this.getAccount(accountIndex, this.interpreter);
    const appId = this.interpreter.tx.apid;

    // get updated local state for account
    const localState = updateLocalState(appId, account, key, value);
    const acc = this.assertAccountDefined(this.interpreter.accounts.get(account.address));
    acc["apps-local-state"] = localState;
  }
}

// write key A and value B to global state of the current application
// [...stack]
export class AppGlobalPut extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 2);
    const value = stack.pop();
    const key = this.assertBytes(stack.pop());

    const appId = this.interpreter.tx.apid;
    const globalState = updateGlobalState(appId, key, value, this.interpreter);

    const globalApp = this.assertAppDefined(appId, this.interpreter);
    globalApp["global-state"] = globalState;
  }
}

// delete from account specified by Txn.Accounts[A] local state key B of the current application
// [...stack]
export class AppLocalDel extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const key = this.assertBytes(stack.pop());
    const accountIndex = this.assertBigInt(stack.pop());

    const appId = this.interpreter.tx.apid;
    const account = this.getAccount(accountIndex, this.interpreter);

    const localState = account["apps-local-state"];
    const idx = localState.findIndex(state => state.id === appId);
    if (idx !== -1) {
      const arr = localState[idx]["key-value"].filter((obj) => {
        return !compareArray(obj.key, key);
      });
      localState[idx]["key-value"] = arr;

      let acc = this.interpreter.accounts.get(account.address);
      acc = this.assertAccountDefined(acc);
      acc["apps-local-state"] = localState;
    }
  }
}

// delete key A from a global state of the current application
// [...stack]
export class AppGlobalDel extends Op {
  readonly interpreter: Interpreter;

  /**
   * Description: Asserts 0 arguments are passed.
   * @param args Expected arguments: [] // none
   * @param line line number in TEAL file
   * @param interpreter interpreter object
   */
  constructor (args: string[], line: number, interpreter: Interpreter) {
    super();
    assertLen(args.length, 0, line);
    this.interpreter = interpreter;
  }

  execute (stack: TEALStack): void {
    this.assertMinStackLen(stack, 1);
    const key = this.assertBytes(stack.pop());

    const appId = this.interpreter.tx.apid;

    const appDelta = this.assertAppDefined(appId, this.interpreter);
    if (appDelta) {
      const globalState = appDelta["global-state"];
      const arr = globalState.filter((obj) => {
        return !compareArray(obj.key, key);
      });
      appDelta["global-state"] = arr;
    }
  }
}

/** Pseudo-Ops **/
// push integer to stack
// [...stack, integer value]
export class Int extends Op {
  readonly uint64: bigint;

  /**
   * Description: Sets uint64 variable according to arguments passed.
   * @param args Expected arguments: [number]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 1, line);
    assertOnlyDigits(args[0]);
    this.uint64 = BigInt(args[0]);
  }

  execute (stack: TEALStack): void {
    stack.push(this.uint64);
  }
}

// push bytes to stack
// [...stack, converted data]
export class Byte extends Op {
  readonly str: string;
  readonly encoding: EncodingType;

  /**
   * Description: Sets `str` and  `encoding` values according to arguments passed.
   * @param args Expected arguments: [data string]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    [this.str, this.encoding] = getEncoding(args, line);
  }

  execute (stack: TEALStack): void {
    const buffer = convertToBuffer(this.str, this.encoding);
    stack.push(new Uint8Array(buffer));
  }
}

// decodes algorand address to bytes and pushes to stack
// [...stack, address]
export class Addr extends Op {
  readonly addr: string;

  /**
   * Description: Sets `addr` value according to arguments passed.
   * @param args Expected arguments: [Address]
   * @param line line number in TEAL file
   */
  constructor (args: string[], line: number) {
    super();
    assertLen(args.length, 1, line);
    if (!isValidAddress(args[0])) {
      throw new TealError(ERRORS.TEAL.INVALID_ADDR, { addr: args[0], line: line });
    }
    this.addr = args[0];
  };

  execute (stack: TEALStack): void {
    const addr = decodeAddress(this.addr);
    stack.push(addr.publicKey);
  }
}
