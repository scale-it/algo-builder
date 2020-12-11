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
import { BIGINT0, Label } from "./opcode-list";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  tx: Transaction;
  gtxs: Transaction[];
  accounts: AccountsMap;
  instructions: Operator[];
  i: number;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.accounts = <AccountsMap>{};
    this.tx = <Transaction>{}; // current transaction
    this.gtxs = []; // all transactions
    this.instructions = [];
    this.i = 0; // set instruction index to zero
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
   * Description: moves instruction index to "label", throws error if label not found
   * @param label: branch label
   */
  jumpForward (label: string): void {
    while (++this.i < this.instructions.length) {
      const instruction = this.instructions[this.i];
      if (instruction instanceof Label && instruction.label === label) {
        return;
      }
    }
    throw new TealError(ERRORS.TEAL.LABEL_NOT_FOUND, {
      label: label
    });
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
    this.instructions = logic;

    while (this.i < this.instructions.length) {
      const instruction = this.instructions[this.i];
      instruction.execute(this.stack);
      this.i++;
    }

    if (this.stack.length() === 1) {
      const s = this.stack.pop();

      if (!(s instanceof Uint8Array) && s > BIGINT0) {
        return true;
      }
    }
    throw new TealError(ERRORS.TEAL.INVALID_STACK_ELEM);
  }
}
