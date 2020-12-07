import { mkTransaction } from "algob";
import type { execParams } from "algob/src/types";
import { assignGroupID, Transaction } from "algosdk";
import { assert } from "chai";

import { mockSuggestedParams } from "../../test/mocks/txn";
import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { Stack } from "../lib/stack";
import type { Operator, StackElem, TEALStack } from "../types";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  txnContext: Transaction | Transaction[];

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.txnContext = [];
  }

  /**
   * Description: creates a new transaction object from given execParams
   * @param  txnParams : Transaction parameters for current txn or txn Group
   * @returns Transaction object
   */
  createTxnContext (txnParams: execParams | execParams[]): Transaction | Transaction[] {
    if (Array.isArray(txnParams)) {
      if (txnParams.length > 16) {
        throw new Error("Maximum size of an atomic transfer group is 16");
      }

      const txns = [];
      for (const txnParam of txnParams) {
        const mockParams = mockSuggestedParams(txnParam.payFlags);
        const txn = mkTransaction(txnParam, mockParams);
        txns.push(txn);
      }
      assignGroupID(txns);
      return txns;
    } else {
      const mockParams = mockSuggestedParams(txnParams.payFlags);
      return mkTransaction(txnParams, mockParams);
    }
  }

  /**
   * Description: this function executes set of Operator[] passed after
   * parsing teal code
   * @param {execParams} txn : Transaction parameters for current txn
   * @param {Logic[]} logic : set of Logic objects
   * @param {AppArgs} args : argument array passed to the current transaction
   * @returns {boolean} : transaction accepted/rejected based on asc logic
   */
  execute (txnParams: execParams | execParams[], logic: Operator[], args: Uint8Array[]): boolean {
    assert(Array.isArray(args));
    this.txnContext = this.createTxnContext(txnParams);

    for (const l of logic) {
      l.execute(this.stack); // execute each teal opcode
    }
    if (this.stack.length() > 0) {
      const top = this.stack.pop();
      if (top instanceof Uint8Array || typeof top === 'undefined') {
        throw new TealError(ERRORS.TEAL.LOGIC_REJECTION);
      }
      if (top >= BigInt("1")) { return true; } // Logic accept
    }
    return false; // Logic Reject
  }
}
