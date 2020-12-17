import { mkTransaction } from "algob";
import type { ExecParams } from "algob/src/types";
import { AccountInfo, assignGroupID } from "algosdk";
import { assert } from "chai";

import { mockSuggestedParams } from "../../test/mocks/txn";
import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { Stack } from "../lib/stack";
import type { AccountsMap, Operator, StackElem, TEALStack, Txn } from "../types";
import { BIGINT0, Label } from "./opcode-list";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  tx: Txn;
  gtxs: Txn[];
  accounts: AccountsMap;
  instructions: Operator[];
  instructionIndex: number;
  args: Uint8Array[];

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.accounts = <AccountsMap>{};
    this.tx = <Txn>{}; // current transaction
    this.gtxs = []; // all transactions
    this.instructions = [];
    this.instructionIndex = 0; // set instruction index to zero
    this.args = [];
  }

  /**
   * Description: creates a new transaction object from given execParams
   * @param txnParams : Transaction parameters for current txn or txn Group
   */
  createTxnContext (txnParams: ExecParams | ExecParams[]): void {
    // if txnParams is array, then user is requesting for a group txn
    if (Array.isArray(txnParams)) {
      if (txnParams.length > 16) {
        throw new Error("Maximum size of an atomic transfer group is 16");
      }

      const txns = [];
      for (const txnParam of txnParams) { // create encoded_obj for each txn in group
        const mockParams = mockSuggestedParams(txnParam.payFlags);
        const tx = mkTransaction(txnParam, mockParams);

        // convert to encoded obj for compatibility
        const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
        encodedTxnObj.txID = tx.txID();
        txns.push(encodedTxnObj);
      }
      assignGroupID(txns); // assign unique groupID to all transactions in the array/group
      this.gtxs = txns;
      this.tx = txns[0]; // by default current txn is the first txn
    } else {
      // if not array, then create a single transaction
      const mockParams = mockSuggestedParams(txnParams.payFlags);
      const tx = mkTransaction(txnParams, mockParams);

      const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
      encodedTxnObj.txID = tx.txID();
      this.tx = encodedTxnObj; // assign current txn
      this.gtxs = [this.tx]; // assing single txn to grp
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
   * Description: this function executes set of Operator[] passed after
   * parsing teal code
   * @param {ExecParams} txn : Transaction parameters
   * @param {Logic[]} logic : smart contract instructions
   * @param {AppArgs} args : external arguments
   * @returns {boolean} : transaction accepted/rejected based on ASC logic
   */
  execute (txnParams: ExecParams | ExecParams[],
    logic: Operator[], args: Uint8Array[],
    accounts: AccountInfo[]): boolean {
    assert(Array.isArray(args));
    this.createTxnContext(txnParams);
    this.createStatefulContext(accounts);
    this.instructions = logic;

    while (this.instructionIndex < this.instructions.length) {
      const instruction = this.instructions[this.instructionIndex];
      instruction.execute(this.stack);
      this.instructionIndex++;
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
