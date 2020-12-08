import { mkTransaction } from "algob";
import type { execParams } from "algob/src/types";
import { AccountInfo, assignGroupID, Transaction } from "algosdk";
import { assert } from "chai";

import { mockSuggestedParams } from "../../test/mocks/txn";
import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { Stack } from "../lib/stack";
import type { AccountsMap, Operator, StackElem, TEALStack } from "../types";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  tx: Transaction;
  gtxs: Transaction[];
  accounts: AccountsMap;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.accounts = <AccountsMap>{};
    this.tx = <Transaction>{}; // current transaction
    this.gtxs = []; // all transactions
  }

  /**
   * Description: creates a new transaction object from given execParams
   * @param txnParams : Transaction parameters for current txn or txn Group
   */
  createTxnContext (txnParams: execParams | execParams[]): void {
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
      this.gtxs = txns;
      this.tx = txns[0]; // by default current txn is the first txn
    } else {
      const mockParams = mockSuggestedParams(txnParams.payFlags);
      this.tx = mkTransaction(txnParams, mockParams);
      this.gtxs = [this.tx];
    }
  }

  /**
   * Description: set accounts for context as {address: accountInfo}
   * @param accounts: array of account info's
   */
  createStatefulContext (accounts: AccountInfo[]): void {
    for (const acc of accounts) {
      this.accounts[acc.address] = acc;
    }
  }

  /**
   * Description: this function executes set of Operator[] passed after
   * parsing teal code
   * @param {execParams} txn : Transaction parameters
   * @param {Logic[]} logic : smart contract instructions
   * @param {AppArgs} args : external arguments
   * @returns {boolean} : transaction accepted/rejected based on ASC logic
   */
  execute (txnParams: execParams | execParams[],
    logic: Operator[], args: Uint8Array[],
    accounts: AccountInfo[]): boolean {
    assert(Array.isArray(args));
    this.createTxnContext(txnParams);
    this.createStatefulContext(accounts);

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
