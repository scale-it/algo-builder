/* eslint sonarjs/no-small-switch: 0 */
import { mkTransaction } from "algob";
import { ASSETS_DIR } from "algob/src/internal/core/project-structure";
import { ExecParams, TransactionType } from "algob/src/types";
import { getProgram } from "algob/test/helpers/fs";
import { assignGroupID, SSCParams } from "algosdk";
import path from "path";

import { mockSuggestedParams } from "../../../algorand-js/build/test/mocks/txn";
import { Interpreter } from "../../src/index";
import type { SdkAccount, State, Txn } from "../../src/types";

function getPath (file: string): string {
  return path.join(process.cwd(), ASSETS_DIR, file);
}

export class Runtime {
  interpreter: Interpreter;
  storage: State;

  constructor (interpreter: Interpreter) {
    this.interpreter = interpreter;
    this.storage = {
      accounts: new Map<string, SdkAccount>(),
      globalApps: new Map<number, SSCParams>(),
      tx: <Txn>{},
      gtxs: []
    };
  }

  /**
   * Description: set accounts for context as {address: SdkAccount}
   * @param accounts: array of account info's
   */
  createStatefulContext (accounts: SdkAccount[]): void {
    for (const acc of accounts) {
      this.storage.accounts.set(acc.address, acc);
    }
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
      this.storage.gtxs = txns;
      this.storage.tx = txns[0]; // by default current txn is the first txn
    } else {
      // if not array, then create a single transaction
      const mockParams = mockSuggestedParams(txnParams.payFlags);
      const tx = mkTransaction(txnParams, mockParams);

      const encodedTxnObj = tx.get_obj_for_encoding() as Txn;
      encodedTxnObj.txID = tx.txID();
      this.storage.tx = encodedTxnObj; // assign current txn
      this.storage.gtxs = [this.storage.tx]; // assign single txn to grp
    }
  }

  prepareInitialState (txnParams: ExecParams| ExecParams[], accounts: SdkAccount[]): void {
    this.createTxnContext(txnParams);
    this.createStatefulContext(accounts); // initialize state before execution
  }

  // updates account balance as per transaction parameters
  updateBalance (txnParam: ExecParams, account: SdkAccount): void {
    switch (txnParam.type) {
      case TransactionType.TransferAlgo: {
        switch (account.address) {
          case txnParam.fromAccount.addr: {
            account.amount -= txnParam.amountMicroAlgos; // remove 'x' algo from sender
            break;
          }
          case txnParam.toAccountAddr: {
            account.amount += txnParam.amountMicroAlgos; // add 'x' algo to receiver
            break;
          }
        }
      }
    }
  }

  /**
   * Description: update current state and account balances
   * @param txnParams : Transaction parameters
   * @param accounts : accounts passed by user
   */
  prepareFinalState (txnParams: ExecParams | ExecParams[], accounts: SdkAccount[]): void {
    if (Array.isArray(txnParams)) { // if txn is a group, update balance as per 'each' transaction
      for (const txnParam of txnParams) {
        for (const acc of accounts) {
          this.updateBalance(txnParam, acc);
        }
      }
    } else {
      // for a single (stand alone) transaction
      for (const acc of accounts) {
        this.updateBalance(txnParams, acc);
      }
    }
  }

  /**
   * Description: this function executes a transaction based on a smart
   * contract logic and updates state afterwards
   * @param txn : Transaction parameters
   * @param fileName : smart contract file (.teal) name in assets/
   * @param args : external arguments to smart contract
   */
  async executeTx (txnParams: ExecParams | ExecParams[], fileName: string,
    args: Uint8Array[], accounts: SdkAccount[]): Promise<void> {
    this.prepareInitialState(txnParams, accounts); // prepare initial state

    const program = getProgram(fileName);
    const updatedState = await this.interpreter.execute(program, args, this.storage);
    this.storage = updatedState; // update account('local-state', 'global-state'..)
    this.prepareFinalState(txnParams, accounts); // update account balances
  }
}
