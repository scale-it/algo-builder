import { tx as webTx, types } from "@algo-builder/web";
import { getApplicationAddress, makeAssetTransferTxnWithSuggestedParams, modelsv2 } from "algosdk";

import { AccountStore, parseASADef, Runtime } from ".";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { validateOptInAccNames } from "./lib/asa";
import { ALGORAND_MIN_TX_FEE } from "./lib/constants";
import { mockSuggestedParams } from "./mock/tx";
import {
  AccountAddress, AccountStoreI,
  AppDeploymentFlags,
  ASADeploymentFlags, AssetHoldingM,
  Context, ExecutionMode,
  ID, SSCAttributesM, StackElem, State, Txn
} from "./types";

const APPROVAL_PROGRAM = "approval-program";

export class Ctx implements Context {
  state: State;
  tx: Txn;
  gtxs: Txn[];
  args: Uint8Array[];
  runtime: Runtime;
  debugStack?: number; //  max number of top elements from the stack to print after each opcode execution.
  sharedScratchSpace: Map<number, StackElem[]>; // here number is index of transaction in a group
  knowableID: Map<number, ID>; // here number is index of transaction in a group
  // inner transaction props
  isInnerTx: boolean; // true if "ctx" is switched to an inner transaction
  createdAssetID: number; // Asset ID allocated by the creation of an ASA (for an inner-tx)

  constructor (state: State, tx: Txn, gtxs: Txn[], args: Uint8Array[],
    runtime: Runtime, debugStack?: number) {
    this.state = state;
    this.tx = tx;
    this.gtxs = gtxs;
    this.args = args;
    this.runtime = runtime;
    this.debugStack = debugStack;
    // Mapping from the tx index number to the scratch space.
    // Scratch space is a list of elements.
    this.sharedScratchSpace = new Map<number, StackElem[]>();
    this.knowableID = new Map<number, ID>();
    // inner transaction props
    this.isInnerTx = false;
    this.createdAssetID = 0;
  }

  // verify account's balance is above minimum required balance
  assertAccBalAboveMin (address: string): void {
    const account = this.getAccount(address);
    if (account.balance() < account.minBalance) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE, {
        accBalance: account.balance(),
        address: address,
        minbalance: account.minBalance
      });
    }
  }

  // verifies assetId is not frozen for an account
  assertAssetNotFrozen (assetIndex: number, address: AccountAddress): void {
    const assetHolding = this.getAssetHolding(assetIndex, address);
    if (assetHolding["is-frozen"]) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.ACCOUNT_ASSET_FROZEN, {
        assetId: assetIndex,
        address: address
      });
    }
  }

  /**
   * Fetches account from `runtime.ctx`
   * @param address account address
   */
  getAccount (address: string): AccountStoreI {
    const account = this.state.accounts.get(address);
    return this.runtime.assertAccountDefined(address, account);
  }

  /**
   * Returns asset creator account from runtime.ctx or throws error is it doesn't exist
   * @param Asset Index
   */
  getAssetAccount (assetId: number): AccountStoreI {
    const addr = this.state.assetDefs.get(assetId);
    if (addr === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND, { assetId: assetId });
    }
    return this.runtime.assertAccountDefined(addr, this.state.accounts.get(addr));
  }

  /**
   * Returns Asset Definitions
   * @param assetId Asset Index
   */
  getAssetDef (assetId: number): modelsv2.AssetParams {
    const creatorAcc = this.getAssetAccount(assetId);
    const assetDef = creatorAcc.getAssetDef(assetId);
    return this.runtime.assertAssetDefined(assetId, assetDef);
  }

  /**
   * Returns Asset Holding from an account
   * @param assetIndex Asset Index
   * @param address address of account to get holding from
   */
  getAssetHolding (assetIndex: number, address: AccountAddress): AssetHoldingM {
    const account = this.runtime.assertAccountDefined(address, this.state.accounts.get(address));
    const assetHolding = account.getAssetHolding(assetIndex);
    if (assetHolding === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.ASA_NOT_OPTIN, {
        assetId: assetIndex,
        address: address
      });
    }
    return assetHolding;
  }

  /**
   * Fetches app from `ctx state`
   * @param appID Application Index'
   * @param line Line number in teal file
   */
  getApp (appID: number, line?: number): SSCAttributesM {
    const lineNumber = line ?? 'unknown';
    if (!this.state.globalApps.has(appID)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appID: appID, line: lineNumber });
    }
    const accAddress = this.runtime.assertAddressDefined(this.state.globalApps.get(appID));
    const account = this.runtime.assertAccountDefined(
      accAddress, this.state.accounts.get(accAddress)
    );
    return this.runtime.assertAppDefined(appID, account.getApp(appID));
  }

  // transfer ALGO as per transaction parameters
  transferAlgo (txnParam: types.AlgoTransferParam): void {
    const fromAccount = this.getAccount(webTx.getFromAddress(txnParam));
    const toAccount = this.getAccount(txnParam.toAccountAddr);
    txnParam.amountMicroAlgos = BigInt(txnParam.amountMicroAlgos);

    fromAccount.amount -= txnParam.amountMicroAlgos; // remove 'x' algo from sender
    toAccount.amount += BigInt(txnParam.amountMicroAlgos); // add 'x' algo to receiver
    this.assertAccBalAboveMin(fromAccount.address);

    if (txnParam.payFlags.closeRemainderTo) {
      const closeRemToAcc = this.getAccount(txnParam.payFlags.closeRemainderTo);

      closeRemToAcc.amount += fromAccount.amount; // transfer funds of sender to closeRemTo account
      fromAccount.amount = 0n; // close sender's account
    }
  }

  /**
   * Add asset using asa.yaml file
   * @param name asset name
   * @param fromAccountAddr account address
   * @param flags asa deployment flags
   */
  addAsset (
    name: string,
    fromAccountAddr: AccountAddress, flags: ASADeploymentFlags
  ): number {
    return this.addASADef(
      name, this.runtime.loadedAssetsDefs[name], fromAccountAddr, flags
    );
  }

  /**
   * Add Asset without using asa.yaml file
   * @param name ASA name
   * @param asaDef asset defitions
   * @param fromAccountAddr account address of creator
   * @param flags ASA Deployment Flags
   */
  addASADef (
    name: string, asaDef: types.ASADef,
    fromAccountAddr: AccountAddress, flags: ASADeploymentFlags
  ): number {
    const senderAcc = this.getAccount(fromAccountAddr);
    parseASADef(asaDef);
    validateOptInAccNames(this.state.accountNameAddress, asaDef);
    // create asset(with holding) in sender account
    const asset = senderAcc.addAsset(
      ++this.state.assetCounter, name, asaDef
    );
    this.assertAccBalAboveMin(fromAccountAddr);
    this.runtime.mkAssetCreateTx(name, flags, asset);

    this.state.assetDefs.set(this.state.assetCounter, senderAcc.address);
    this.state.assetNameInfo.set(name, {
      creator: senderAcc.address,
      assetIndex: this.state.assetCounter,
      assetDef: asset,
      txId: this.tx.txID,
      confirmedRound: this.runtime.getRound(),
      deleted: false
    });

    if (this.isInnerTx === true) { this.createdAssetID = this.state.assetCounter; }
    return this.state.assetCounter;
  }

  /**
   * Asset Opt-In for account in context
   * @param assetIndex Asset Index
   * @param address Account address to opt-into asset
   * @param flags Transaction Parameters
   */
  optIntoASA (assetIndex: number, address: AccountAddress, flags: types.TxParams): void {
    const assetDef = this.getAssetDef(assetIndex);
    makeAssetTransferTxnWithSuggestedParams(
      address, address, undefined, undefined, 0, undefined, assetIndex,
      mockSuggestedParams(flags, this.runtime.getRound()));

    const assetHolding: AssetHoldingM = {
      amount: 0n,
      'asset-id': assetIndex,
      creator: assetDef.creator,
      'is-frozen': assetDef.defaultFrozen ? assetDef.defaultFrozen : false
    };
    const account = this.getAccount(address);
    account.optInToASA(assetIndex, assetHolding);
    this.assertAccBalAboveMin(address);
  }

  /**
   * creates new application and returns application id
   * @param fromAccountAddr creator account address
   * @param flags SSCDeployment flags
   * @param payFlags Transaction parameters
   * @param approvalProgram application approval program
   * @param clearProgram application clear program
   * @param idx index of transaction in group
   * NOTE:
   * - approval and clear program must be the TEAL code as string (not compiled code)
   * - When creating or opting into an app, the minimum balance grows before the app code runs
   */
  addApp (
    fromAccountAddr: AccountAddress, flags: AppDeploymentFlags,
    approvalProgram: string, clearProgram: string, idx: number
  ): number {
    const senderAcc = this.getAccount(fromAccountAddr);

    if (approvalProgram === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM);
    }
    if (clearProgram === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM);
    }

    // create app with id = 0 in globalApps for teal execution
    const app = senderAcc.addApp(0, flags, approvalProgram, clearProgram);
    this.assertAccBalAboveMin(senderAcc.address);
    this.state.accounts.set(senderAcc.address, senderAcc);
    this.state.globalApps.set(app.id, senderAcc.address);

    this.runtime.run(
      approvalProgram, ExecutionMode.APPLICATION, idx, this.debugStack
    ); // execute TEAL code with appID = 0

    // create new application in globalApps map
    this.state.globalApps.set(++this.state.appCounter, senderAcc.address);

    const attributes = this.getApp(0);
    senderAcc.createdApps.delete(0); // remove zero app from sender's account
    this.state.globalApps.delete(0); // remove zero app from context
    senderAcc.createdApps.set(this.state.appCounter, attributes);
    this.state.appNameInfo.set(
      approvalProgram + "-" + clearProgram,
      {
        creator: senderAcc.address,
        appID: this.state.appCounter,
        applicationAccount: getApplicationAddress(this.state.appCounter),
        txId: this.tx.txID,
        confirmedRound: this.runtime.getRound(),
        timestamp: Math.round(+new Date() / 1000),
        deleted: false
      }
    );

    // create new "app account" (an account belonging to smart contract)
    // https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/#using-a-smart-contract-as-an-escrow
    const acc = new AccountStore(0, {
      addr: getApplicationAddress(this.state.appCounter),
      sk: new Uint8Array(0)
    });
    this.state.accounts.set(acc.address, acc);

    return this.state.appCounter;
  }

  /**
   * Account address opt-in for application Id
   * @param accountAddr Account address to opt into application
   * @param appID Application index
   * @param idx index of transaction in group
   * NOTE: When creating or opting into an app, the minimum balance grows before the app code runs
   */
  optInToApp (accountAddr: AccountAddress, appID: number, idx: number): void {
    const appParams = this.getApp(appID);

    const account = this.getAccount(accountAddr);
    account.optInToApp(appID, appParams);
    this.assertAccBalAboveMin(accountAddr);
    try {
      this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
    } catch (error) {
      account.closeApp(appID); // remove already added state if optIn fails
      throw error;
    }
  }

  /**
   * Verify Pooled Transaction Fees
   * supports pooled fees where one transaction can pay the
   * fees of other transactions within an atomic group.
   * For atomic transactions, the protocol sums the number of
   * transactions and calculates the total amount of required fees,
   * then calculates the amount of fees submitted by all transactions.
   * If the collected fees are greater than or equal to the required amount,
   * the transaction fee requirement will be met.
   * https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/
   */
  verifyMinimumFees (): void {
    if (this.isInnerTx === true) { return; } // pooled fee for inner tx is calculated at itxn_submit
    let collected = 0;
    for (const val of this.gtxs) {
      if (val.fee === undefined) val.fee = 0;
      collected += val.fee;
    }

    const required = this.gtxs.length * ALGORAND_MIN_TX_FEE;
    if (collected < required) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH, {
        required: required,
        collected: collected
      });
    }
  }

  /**
   * Deduct transaction fee from sender account.
   * @param sender Sender address
   * @param index Index of current tx being processed in tx group
   */
  deductFee (sender: AccountAddress, index: number, params: types.TxParams): void {
    let fee: bigint = BigInt(this.gtxs[index].fee as number);
    // If flatFee boolean is not set, change fee value
    if (!params.flatFee && params.totalFee === undefined) {
      fee = BigInt(Math.max(ALGORAND_MIN_TX_FEE, Number(this.gtxs[index].fee)));
    }
    const fromAccount = this.getAccount(sender);
    fromAccount.amount -= fee; // remove tx fee from Sender's account
    this.assertAccBalAboveMin(fromAccount.address);
  }

  // transfer ASSET as per transaction parameters
  transferAsset (txnParam: types.AssetTransferParam): void {
    const fromAccountAddr = webTx.getFromAddress(txnParam);
    txnParam.amount = BigInt(txnParam.amount);
    if (txnParam.amount === 0n && fromAccountAddr === txnParam.toAccountAddr) {
      this.optIntoASA(txnParam.assetID as number, fromAccountAddr, txnParam.payFlags);
    } else if (txnParam.amount !== 0n) {
      this.assertAssetNotFrozen(txnParam.assetID as number, fromAccountAddr);
      this.assertAssetNotFrozen(txnParam.assetID as number, txnParam.toAccountAddr);
    }

    const fromAssetHolding = this.getAssetHolding(txnParam.assetID as number, fromAccountAddr);
    const toAssetHolding = this.getAssetHolding(txnParam.assetID as number, txnParam.toAccountAddr);
    if (fromAssetHolding.amount - txnParam.amount < 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS, {
        amount: txnParam.amount,
        address: fromAccountAddr
      });
    }
    fromAssetHolding.amount -= txnParam.amount;
    toAssetHolding.amount += BigInt(txnParam.amount);

    if (txnParam.payFlags.closeRemainderTo) {
      const closeToAddr = txnParam.payFlags.closeRemainderTo;
      if (fromAccountAddr === fromAssetHolding.creator) {
        throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CREATOR);
      }
      this.assertAssetNotFrozen(txnParam.assetID as number, closeToAddr);

      const closeRemToAssetHolding = this.getAssetHolding(
        txnParam.assetID as number, closeToAddr);

      closeRemToAssetHolding.amount += fromAssetHolding.amount; // transfer assets of sender to closeRemTo account
      const fromAccount = this.getAccount(fromAccountAddr);
      fromAccount.closeAsset(txnParam.assetID as number);
    }
  }

  /**
   * https://developer.algorand.org/docs/features/asa/#modifying-an-asset
   * Modifies asset fields
   * @param assetId Asset Index
   * @param fields Asset modifying fields
   */
  modifyAsset (assetId: number, fields: types.AssetModFields): void {
    const creatorAcc = this.getAssetAccount(assetId);
    creatorAcc.modifyAsset(assetId, fields);
  }

  /**
   * https://developer.algorand.org/docs/features/asa/#freezing-an-asset
   * Freezes assets for a target account
   * @param assetId asset index
   * @param freezeTarget target account
   * @param freezeState target state
   */
  freezeAsset (
    assetId: number, freezeTarget: string, freezeState: boolean
  ): void {
    const acc = this.runtime.assertAccountDefined(
      freezeTarget,
      this.state.accounts.get(freezeTarget)
    );
    acc.setFreezeState(assetId, freezeState);
  }

  /**
   * https://developer.algorand.org/docs/features/asa/#revoking-an-asset
   * Revoking an asset for an account removes a specific number of the asset
   * from the revoke target account.
   * @param recipient asset receiver address
   * @param assetId asset index
   * @param revocationTarget revoke target account
   * @param amount amount of assets
   */
  revokeAsset (
    recipient: string, assetID: number,
    revocationTarget: string, amount: bigint
  ): void {
    // Transfer assets
    const fromAssetHolding = this.getAssetHolding(assetID, revocationTarget);
    const toAssetHolding = this.getAssetHolding(assetID, recipient);

    if (fromAssetHolding.amount - amount < 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS, {
        amount: amount,
        address: revocationTarget
      });
    }
    fromAssetHolding.amount -= amount;
    toAssetHolding.amount += amount;
  }

  /**
   * https://developer.algorand.org/docs/features/asa/#destroying-an-asset
   * Destroy asset
   * @param assetId asset index
   */
  destroyAsset (assetId: number): void {
    const creatorAcc = this.getAssetAccount(assetId);
    // destroy asset from creator's account
    creatorAcc.destroyAsset(assetId);
    // delete asset holdings from all accounts
    this.state.accounts.forEach((value, key) => {
      value.assets.delete(assetId);
    });
  }

  /**
   * Delete application from account's state and global state
   * @param appID Application Index
   */
  deleteApp (appID: number): void {
    if (!this.state.globalApps.has(appID)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appID: appID, line: 'unknown' });
    }
    const accountAddr = this.runtime.assertAddressDefined(this.state.globalApps.get(appID));
    if (accountAddr === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST);
    }
    const account = this.runtime.assertAccountDefined(
      accountAddr, this.state.accounts.get(accountAddr)
    );

    account.deleteApp(appID);
    this.state.globalApps.delete(appID);
  }

  /**
   * Closes application from account's state
   * @param sender Sender address
   * @param appID application index
   */
  closeApp (sender: AccountAddress, appID: number): void {
    const fromAccount = this.getAccount(sender);
    // https://developer.algorand.org/docs/reference/cli/goal/app/closeout/#search-overlay
    this.runtime.assertAppDefined(appID, this.getApp(appID));
    fromAccount.closeApp(appID); // remove app from local state
  }

  /**
   * Update application
   * @param appID application Id
   * @param approvalProgram new approval program
   * @param clearProgram new clear program
   * NOTE - approval and clear program must be the TEAL code as string
   */
  updateApp (
    appID: number,
    approvalProgram: string,
    clearProgram: string,
    idx: number
  ): void {
    if (approvalProgram === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM);
    }
    if (clearProgram === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM);
    }

    const appParams = this.getApp(appID);
    this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);

    const updatedApp = this.getApp(appID);
    updatedApp[APPROVAL_PROGRAM] = approvalProgram;
    updatedApp["clear-state-program"] = clearProgram;
  }

  /**
   * Process transactions in ctx
   * - Runs TEAL code if associated with transaction
   * - Executes the transaction on ctx
   * Note: we're doing this because if any one tx in group fails,
   * then it does not affect runtime.store, otherwise we just update
   * store with ctx (if all transactions are executed successfully).
   * @param txnParams Transaction Parameters
   */
  /* eslint-disable sonarjs/cognitive-complexity */
  processTransactions (txnParams: types.ExecParams[]): void {
    this.verifyMinimumFees();
    txnParams.forEach((txnParam, idx) => {
      const fromAccountAddr = webTx.getFromAddress(txnParam);
      this.deductFee(fromAccountAddr, idx, txnParam.payFlags);

      if (txnParam.sign === types.SignType.LogicSignature) {
        this.tx = this.gtxs[idx]; // update current tx to index of stateless
        this.runtime.validateLsigAndRun(txnParam, this.debugStack);
        this.tx = this.gtxs[0]; // after executing stateless tx updating current tx to default (index 0)
      }

      // https://developer.algorand.org/docs/features/asc1/stateful/#the-lifecycle-of-a-stateful-smart-contract
      switch (txnParam.type) {
        case types.TransactionType.TransferAlgo: {
          this.transferAlgo(txnParam);
          break;
        }
        case types.TransactionType.TransferAsset: {
          this.transferAsset(txnParam);
          break;
        }
        case types.TransactionType.CallApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txnParam.appID);
          this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
          break;
        }
        case types.TransactionType.CloseApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txnParam.appID);
          this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
          this.closeApp(fromAccountAddr, txnParam.appID);
          break;
        }
        case types.TransactionType.UpdateApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index

          this.updateApp(
            txnParam.appID, txnParam.newApprovalProgram, txnParam.newClearProgram, idx
          );
          break;
        }
        case types.TransactionType.ClearApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.runtime.assertAppDefined(txnParam.appID, this.getApp(txnParam.appID));
          try {
            this.runtime.run(appParams["clear-state-program"], ExecutionMode.APPLICATION, idx, this.debugStack);
          } catch (error) {
            // if transaction type is Clear Call, remove the app without throwing error (rejecting tx)
            // tested by running on algorand network
            // https://developer.algorand.org/docs/features/asc1/stateful/#the-lifecycle-of-a-stateful-smart-contract
          }

          this.closeApp(fromAccountAddr, txnParam.appID); // remove app from local state
          break;
        }
        case types.TransactionType.DeleteApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txnParam.appID);
          this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
          this.deleteApp(txnParam.appID);
          break;
        }
        case types.TransactionType.ModifyAsset: {
          const asset = this.getAssetDef(txnParam.assetID as number);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          // modify asset in ctx.
          this.modifyAsset(txnParam.assetID as number, txnParam.fields);
          break;
        }
        case types.TransactionType.FreezeAsset: {
          const asset = this.getAssetDef(txnParam.assetID as number);
          if (asset.freeze !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.FREEZE_ERROR, { address: asset.freeze });
          }
          this.freezeAsset(txnParam.assetID as number, txnParam.freezeTarget, txnParam.freezeState);
          break;
        }
        case types.TransactionType.RevokeAsset: {
          const asset = this.getAssetDef(txnParam.assetID as number);
          if (asset.clawback !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.CLAWBACK_ERROR, { address: asset.clawback });
          }
          if (txnParam.payFlags.closeRemainderTo) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CLAWBACK);
          }
          this.revokeAsset(
            txnParam.recipient, txnParam.assetID as number,
            txnParam.revocationTarget, BigInt(txnParam.amount)
          );
          break;
        }
        case types.TransactionType.DestroyAsset: {
          const asset = this.getAssetDef(txnParam.assetID as number);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          this.destroyAsset(txnParam.assetID as number);
          break;
        }
        case types.TransactionType.DeployASA: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const senderAcc = this.getAccount(fromAccountAddr);
          const flags: ASADeploymentFlags = {
            ...txnParam.payFlags,
            creator: { ...senderAcc.account, name: senderAcc.address }
          };
          let assetID: number;
          if (txnParam.asaDef) {
            assetID = this.addASADef(txnParam.asaName, txnParam.asaDef, fromAccountAddr, flags);
          } else {
            assetID = this.addAsset(txnParam.asaName, fromAccountAddr, flags);
          }
          this.knowableID.set(idx, assetID);
          break;
        }
        case types.TransactionType.OptInASA: {
          this.optIntoASA(txnParam.assetID as number, fromAccountAddr, txnParam.payFlags);
          break;
        }
        case types.TransactionType.DeployApp: {
          const senderAcc = this.getAccount(fromAccountAddr);
          const flags: AppDeploymentFlags = {
            sender: senderAcc.account,
            localInts: txnParam.localInts,
            localBytes: txnParam.localBytes,
            globalInts: txnParam.globalInts,
            globalBytes: txnParam.globalBytes
          };
          this.tx = this.gtxs[idx]; // update current tx to the requested index

          const appID = this.addApp(
            fromAccountAddr, flags,
            txnParam.approvalProgram,
            txnParam.clearProgram,
            idx
          );
          this.knowableID.set(idx, appID);
          break;
        }
        case types.TransactionType.OptInToApp: {
          this.tx = this.gtxs[idx]; // update current tx to txn being exectuted in group

          this.optInToApp(fromAccountAddr, txnParam.appID, idx);
          break;
        }
      }
    });
  }
}
