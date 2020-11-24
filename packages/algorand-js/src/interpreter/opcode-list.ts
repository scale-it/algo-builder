import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import type { TEALStack } from "../types";
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
