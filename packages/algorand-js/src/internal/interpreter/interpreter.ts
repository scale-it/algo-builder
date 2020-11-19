import type { execParams } from "algob/src/types";
import { assert } from "chai";

import type { AppArgs, Logic } from "../types";
import { Stack } from "./stack";

/**
 * Description: this function executes set of logic[] passed after
 * parsing teal code
 * @param {execParams} txn : Transaction parameters for current txn
 * @param {Logic[]} logic : set of Logic objects
 * @param {AppArgs} args : argument array passed to the current transaction
 * @returns {boolean} : transaction accepted/rejected based on asc logic
 */
export function execute (txn: execParams, logic: Logic[], args: AppArgs): boolean {
  assert(Array.isArray(args));
  const stack = new Stack<string | bigint>();
  for (const l of logic) {
    l.execute(stack); // execute each teal opcode
  }
  if (stack.length() > 0) {
    const top = stack.pop() as BigInt;
    if (typeof top === 'string' || top >= BigInt(1)) { return true; } // Logic accept
  }
  return false; // Logic Reject
}
