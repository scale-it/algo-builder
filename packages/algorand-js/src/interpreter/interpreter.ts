import { mkTransaction } from "algob";
import type { execParams } from "algob/src/types";
import { AccountInfo, assignGroupID } from "algosdk";
import { assert } from "chai";

import { mockSuggestedParams } from "../../test/mocks/txn";
import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { DEFAULT_STACK_ELEM } from "../lib/constants";
import { Stack } from "../lib/stack";
import type { AccountsMap, AssetInfo, AssetsMapAccount, AssetsMapGlobal, Operator, StackElem, TEALStack, Txn } from "../types";

export class Interpreter {
  readonly stack: TEALStack;
  bytecblock: Uint8Array[];
  intcblock: BigInt[];
  scratch: StackElem[];
  tx: Txn;
  gtxs: Txn[];
  accounts: AccountsMap;
  accountAssets: AssetsMapAccount;
  globalAssets: AssetsMapGlobal;

  constructor () {
    this.stack = new Stack<StackElem>();
    this.bytecblock = [];
    this.intcblock = [];
    this.scratch = new Array(256).fill(DEFAULT_STACK_ELEM);
    this.accounts = <AccountsMap>{};
    this.accountAssets = <AssetsMapAccount>{};
    this.globalAssets = <AssetsMapGlobal>{};
    this.tx = <Txn>{}; // current transaction
    this.gtxs = []; // all transactions
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
  createStatefulContext (accounts: AccountInfo[], globalAssets: AssetsMapGlobal): void {
    for (const acc of accounts) {
      this.accounts[acc.address] = acc;

      const assets = acc.assets;
      const assetInfo: AssetInfo = <AssetInfo>{};
      for (const asset of assets) {
        assetInfo[asset["asset-id"]] = asset;
      }

      this.accountAssets[acc.address] = assetInfo;
    }

    this.globalAssets = globalAssets;
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
    accounts: AccountInfo[], globalAssets: AssetsMapGlobal): boolean {
    assert(Array.isArray(args));
    this.createTxnContext(txnParams);
    this.createStatefulContext(accounts, globalAssets);

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
