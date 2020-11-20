import type { execParams } from "algob/src/types";
import { assert } from "chai";

import { IStack, Stack } from "../../lib/stack";
import type { AppArgs, Operator, StackElem } from "../types";

export class Interpreter {
  readonly _stack: IStack<StackElem>;

  constructor () {
    this._stack = new Stack<StackElem>();
  }

  /**
 * Description: this function executes set of Operator[] passed after
 * parsing teal code
 * @param {execParams} txn : Transaction parameters for current txn
 * @param {Logic[]} logic : set of Logic objects
 * @param {AppArgs} args : argument array passed to the current transaction
 * @returns {boolean} : transaction accepted/rejected based on asc logic
 */
  execute (txn: execParams, logic: Operator[], args: AppArgs): boolean {
    assert(Array.isArray(args));
    for (const l of logic) {
      l.execute(this._stack); // execute each teal opcode
    }
    if (this._stack.length() > 0) {
      const top = this._stack.pop() as BigInt;
      if (typeof top === 'string' || top >= BigInt("1")) { return true; } // Logic accept
    }
    return false; // Logic Reject
  }
}
