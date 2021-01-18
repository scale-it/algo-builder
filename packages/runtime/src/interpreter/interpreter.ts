import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Runtime } from "../index";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { Stack } from "../lib/stack";
import { parser } from "../parser/parser";
import type { Operator, StackElem, TEALStack } from "../types";
import { BIGINT0, Label } from "./opcode-list";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  instructions: Operator[];
  instructionIndex: number;
  runtime: Runtime;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.instructions = [];
    this.instructionIndex = 0; // set instruction index to zero
    this.runtime = <Runtime>{};
  }

  /**
   * Description: moves instruction index to "label", throws error if label not found
   * @param label: branch label
   */
  jumpForward (label: string, line: number): void {
    while (++this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      if (instruction instanceof Label && instruction.label === label) {
        return;
      }
    }
    throw new TealError(ERRORS.TEAL.LABEL_NOT_FOUND, {
      label: label,
      line: line
    });
  }

  /**
   * Description: this function executes TEAL code after parsing
   * @param {string} program: teal code
   * @param {Runtime} runtime : runtime object
   */
  async execute (program: string, runtime: Runtime): Promise<void> {
    this.runtime = runtime;
    this.instructions = await parser(program, this);

    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      instruction.execute(this.stack);
      this.instructionIndex++;
    }

    if (this.stack.length() === 1) {
      const s = this.stack.pop();

      if (!(s instanceof Uint8Array) && s > BIGINT0) { return; }
    }
    throw new TealError(ERRORS.TEAL.REJECTED_BY_LOGIC);
  }
}
