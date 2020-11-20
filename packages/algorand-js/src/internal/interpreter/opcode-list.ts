import { IStack } from "../../lib/stack";
import { TealError } from "../core/errors";
import { ERRORS } from "../core/errors-list";
import type { AppArgs, StackElem } from "../types";
import { Op } from "./opcode";

const BIGINT_0 = BigInt(0);
// pops string([]byte) from stack and pushes it's length to stack
export class Len extends Op {
  execute (stack: IStack<StackElem>): void {
    this.assertStackLen(stack, 1);
    const top = stack.pop();
    if (typeof top !== 'string') {
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
  execute (stack: IStack<StackElem>): void {
    this.assertStackLen(stack, 2);
    const a = stack.pop();
    const b = stack.pop();
    if (typeof a !== 'bigint' || typeof b !== 'bigint') {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "+"
      });
    }
    this.checkOverFlow(a + b);
    stack.push(a + b);
  }
}

// pops two unit64 from stack(a, b) and pushes their diff(a - b) to stack
// panics on underflow (result < 0)
export class Sub extends Op {
  execute (stack: IStack<StackElem>): void {
    this.assertStackLen(stack, 2);
    const a = stack.pop();
    const b = stack.pop();
    if (typeof a !== 'bigint' || typeof b !== 'bigint') {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "-"
      });
    }
    this.checkUnderFlow(a - b);
    stack.push(a - b);
  }
}

// pops two unit64 from stack(a, b) and pushes their division(a / b) to stack
// panics if b == 0
export class Div extends Op {
  execute (stack: IStack<StackElem>): void {
    this.assertStackLen(stack, 2);
    const a = stack.pop();
    const b = stack.pop();
    if (typeof a !== 'bigint' || typeof b !== 'bigint' || b === BIGINT_0) {
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
  execute (stack: IStack<StackElem>): void {
    this.assertStackLen(stack, 2);
    const a = stack.pop();
    const b = stack.pop();
    if (typeof a !== 'bigint' || typeof b !== 'bigint') {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "*"
      });
    }
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

  execute (stack: IStack<StackElem>): void {
    const arg = this._args[0];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_0"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(BigInt(arg));
      stack.push(BigInt(arg));
    } else { stack.push(arg); }
  }
}

// pushes 2nd argument from argument array to stack
export class Arg_1 extends Arg_0 {
  execute (stack: IStack<StackElem>): void {
    const arg = this._args[1];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_1"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(BigInt(arg));
      stack.push(BigInt(arg));
    } else { stack.push(arg); }
  }
}

// pushes 3rd argument from argument array to stack
export class Arg_2 extends Arg_0 {
  execute (stack: IStack<StackElem>): void {
    const arg = this._args[2];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_2"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(BigInt(arg));
      stack.push(BigInt(arg));
    } else { stack.push(arg); }
  }
}

// pushes 4th argument from argument array to stack
export class Arg_3 extends Arg_0 {
  execute (stack: IStack<StackElem>): void {
    const arg = this._args[3];
    if (arg === undefined || (typeof arg !== 'string' && typeof arg !== 'number')) {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "arg_3"
      });
    }
    if (typeof arg === 'number') {
      this.checkOverFlow(BigInt(arg));
      stack.push(BigInt(arg));
    } else { stack.push(arg); }
  }
}
