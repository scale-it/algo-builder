import { assert } from "chai";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { Stack } from "../lib/stack";
import type { Operator, StackElem, Storage, TEALStack } from "../types";
import { BIGINT0, Label, Pragma } from "./opcode-list";
import { parser } from "./parser";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  instructions: Operator[];
  instructionIndex: number;
  args: Uint8Array[];
  storageBranch: Storage;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.instructions = [];
    this.instructionIndex = 0; // set instruction index to zero
    this.args = [];
    this.storageBranch = <Storage>{};
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
   * Description: this function executes teal code after parsing
   * @param {string} path: path to teal code
   * @param {Uint8Array[]} args : external arguments
   * @param {Storage} state : current state as input
   */
  async execute (path: string, args: Uint8Array[],
    state: Storage): Promise<Storage> {
    assert(Array.isArray(args));
    this.storageBranch = state;
    this.instructions = await parser(path, this);

    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      if (!(instruction instanceof Pragma)) {
        instruction.execute(this.stack);
      }
      this.instructionIndex++;
    }

    if (this.stack.length() === 1) {
      const s = this.stack.pop();

      if (!(s instanceof Uint8Array) && s > BIGINT0) {
        return this.storageBranch;
      }
    }
    throw new TealError(ERRORS.TEAL.INVALID_STACK_ELEM);
  }
}
