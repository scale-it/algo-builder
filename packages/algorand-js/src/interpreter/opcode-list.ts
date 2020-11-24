import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import type { TEALStack } from "../types";
import { Interpreter } from "./interpreter";
import { Op } from "./opcode";

const BIGINT0 = BigInt("0");
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
