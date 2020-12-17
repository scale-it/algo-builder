/* eslint sonarjs/no-small-switch: 0 */
import { Interpreter } from "algorand-js/src/index";
import type { AccountsMap, Storage, Txn } from "algorand-js/src/types";
import { AccountInfo, assignGroupID } from "algosdk";
import path from "path";

import { mockSuggestedParams } from "../../../algorand-js/build/test/mocks/txn";
import { mkTransaction } from "../../src/index";
import { ASSETS_DIR } from "../../src/internal/core/project-structure";
import { execParams, TransactionType } from "../../src/types";

function getPath (file: string): string {
  return path.join(process.cwd(), ASSETS_DIR, file);
}

export class Runtime {
  interpreter: Interpreter;
  storage: Storage;

  constructor (interpreter: Interpreter) {
    this.interpreter = interpreter;
    this.storage = {
      accounts: <AccountsMap>{},
      tx: <Txn>{},
      gtxs: []
    };
  }

  /**
   * Description: set accounts for context as {address: accountInfo}
   * @param accounts: array of account info's
   */
  createStatefulContext (accounts: AccountInfo[]): void {
    for (const acc of accounts) {
      this.storage.accounts[acc.address] = acc;
    }
  }

  /**
   * Description: creates a new transaction object from given execParams
   * @param txnParams : Transaction parameters for current txn or txn Group
   */
  createTxnContext (txnParams: execParams | execParams[]): void {
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

  // updates account balance as per transaction parameters
  updateBalance (txnParam: execParams, account: AccountInfo): void {
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
  setState (txnParams: execParams | execParams[], accounts: AccountInfo[]): void {
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
  async execute (txnParams: execParams | execParams[], fileName: string,
    args: Uint8Array[], accounts: AccountInfo[]): Promise<void> {
    this.createTxnContext(txnParams);
    this.createStatefulContext(accounts); // initialize state before execution

    const updatedState = await this.interpreter.execute(getPath(fileName), args, this.storage);
    this.storage = updatedState; // update account('local-state', 'global-state'..)
    this.setState(txnParams, accounts); // update account balances
  }
}
