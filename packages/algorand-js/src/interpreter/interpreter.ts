import type { execParams } from "algob/src/types";
import { assert } from "chai";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Stack } from "../lib/stack";
import type { Operator, StackElem, TEALStack } from "../types";

export class Interpreter {
  readonly stack: TEALStack;

  constructor () {
    this.stack = new Stack<StackElem>();
  }

  /**
 * Description: this function executes set of Operator[] passed after
 * parsing teal code
 * @param {execParams} txn : Transaction parameters for current txn
 * @param {Logic[]} logic : set of Logic objects
 * @param {AppArgs} args : argument array passed to the current transaction
 * @returns {boolean} : transaction accepted/rejected based on asc logic
 */
  execute (txn: execParams, logic: Operator[], args: Uint8Array[]): boolean {
    assert(Array.isArray(args));
    for (const l of logic) {
      l.execute(this.stack); // execute each teal opcode
    }
    if (this.stack.length() > 0) {
      const top = this.stack.pop();
      if (top instanceof Uint8Array || typeof top === 'undefined') {
        throw new TealError(ERRORS.TEAL.TEAL_REJECTION_ERROR);
      }
      if (top >= BigInt("1")) { return true; } // Logic accept
    }
    return false; // Logic Reject
  }
}
