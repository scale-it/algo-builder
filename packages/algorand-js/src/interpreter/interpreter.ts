import { assert } from "chai";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Runtime } from "../index";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { Stack } from "../lib/stack";
import { parser } from "../parser/parser";
import type { Operator, StackElem, State, TEALStack } from "../types";
import { Context } from "../types";
import { BIGINT0, Label } from "./opcode-list";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  instructions: Operator[];
  instructionIndex: number;
  args: Uint8Array[];
  ctx: Context; // interpreter's 'local' context
  runtime: Runtime;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.instructions = [];
    this.instructionIndex = 0; // set instruction index to zero
    this.args = [];
    this.ctx = <Context>{};
    this.runtime = <Runtime>{};
  }

  /**
   * Description: moves instruction index to "label", throws error if label not found
   * @param label: branch label
   */
  jumpForward (label: string): void {
    while (++this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      if (instruction instanceof Label && instruction.label === label) {
        return;
      }
    }
    throw new TealError(ERRORS.TEAL.LABEL_NOT_FOUND, {
      label: label
    });
  }

  /**
   * Description: this function executes TEAL code after parsing
   * @param {string} program: teal code
   * @param {Uint8Array[]} args : external arguments
   * @param {State} state : current state as input
   */
  async execute (program: string, args: Uint8Array[],
    runtime: Runtime): Promise<State> {
    assert(Array.isArray(args));
    this.runtime = runtime;
    this.ctx = runtime.store; // set local context of interpreter
    this.instructions = await parser(program, this);

    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      instruction.execute(this.stack);
      this.instructionIndex++;
    }

    if (this.stack.length() === 1) {
      const s = this.stack.pop();

      if (!(s instanceof Uint8Array) && s > BIGINT0) {
        return this.ctx.state;
      }
    }
    throw new TealError(ERRORS.TEAL.INVALID_STACK_ELEM);
  }
}
