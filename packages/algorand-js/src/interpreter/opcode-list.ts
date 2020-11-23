import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { parseNum, toBytes } from "../lib/parse-data";
import type { AppArgs, TEALStack } from "../types";
import { Op } from "./opcode";

const BIGINT0 = BigInt("0");
// pops string([]byte) from stack and pushes it's length to stack
export class Len extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 1);
    const top = stack.pop();
    if (typeof top === 'undefined' || !(top instanceof Uint8Array)) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "len"
      });
    }
    stack.push(BigInt(top.length));
  }
}

// pops two unit64 from stack(a, b) and pushes their sum(a + b) to stack
// panics on overflow (result > max_unit64)
export class Add extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    this.checkOverFlow(a + b);
    stack.push(a + b);
  }
}

// pops two unit64 from stack(a, b) and pushes their diff(a - b) to stack
// panics on underflow (result < 0)
export class Sub extends Op {
  execute (stack: TEALStack): void {
    this.assertStackLen(stack, 2);
    const a = this.assertBigInt(stack.pop());
    const b = this.assertBigInt(stack.pop());
    this.checkUnderFlow(a - b);
    stack.push(a - b);
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
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "/"
      });
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
    this.checkOverFlow(a * b);
    stack.push(a * b);
  }
}

// pushes 1st argument from argument array to stack
export class Arg_0 extends Op {
  readonly _args;

  constructor (args: AppArgs) {
    super();
    this._args = args;
  };

  execute (stack: TEALStack): void {
    const arg = this._args[0];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_0"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(parseNum(arg));
      stack.push(parseNum(arg));
    } else { stack.push(toBytes(arg)); }
  }
}

// pushes 2nd argument from argument array to stack
export class Arg_1 extends Arg_0 {
  execute (stack: TEALStack): void {
    const arg = this._args[1];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_1"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(parseNum(arg));
      stack.push(parseNum(arg));
    } else { stack.push(toBytes(arg)); }
  }
}

// pushes 3rd argument from argument array to stack
export class Arg_2 extends Arg_0 {
  execute (stack: TEALStack): void {
    const arg = this._args[2];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_2"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(parseNum(arg));
      stack.push(parseNum(arg));
    } else { stack.push(toBytes(arg)); }
  }
}

// pushes 4th argument from argument array to stack
export class Arg_3 extends Arg_0 {
  execute (stack: TEALStack): void {
    const arg = this._args[3];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_3"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(parseNum(arg));
      stack.push(parseNum(arg));
    } else { stack.push(toBytes(arg)); }
  }
}
