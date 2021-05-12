import { AssetDef } from "algosdk";

import { getFromAddress, Runtime } from ".";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import {
  AccountAddress, AccountStoreI, AlgoTransferParam, AssetHoldingM, AssetModFields,
  AssetTransferParam, Context, ExecParams, ExecutionMode,
  SignType, SSCAttributesM, State, TransactionType, Txn
} from "./types";

const approvalProgram = "approval-program";

export class Ctx implements Context {
  state: State;
  tx: Txn;
  gtxs: Txn[];
  args: Uint8Array[];
  runtime: Runtime;

  constructor (state: State, tx: Txn, gtxs: Txn[], args: Uint8Array[], runtime: Runtime) {
    this.state = state;
    this.tx = tx;
    this.gtxs = gtxs;
    this.args = args;
    this.runtime = runtime;
  }

  // verify 'amt' microalgos can be withdrawn from account
  assertMinBalance (amt: bigint, address: string): void {
    const account = this.getAccount(address);
    if ((account.amount - amt) < account.minBalance) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE, {
        amount: amt,
        address: address
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
  getAssetDef (assetId: number): AssetDef {
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
   * @param appId Application Index'
   * @param line Line number in teal file
   */
  getApp (appId: number, line?: number): SSCAttributesM {
    const lineNumber = line ?? 'unknown';
    if (!this.state.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: lineNumber });
    }
    const accAddress = this.runtime.assertAddressDefined(this.state.globalApps.get(appId));
    const account = this.runtime.assertAccountDefined(
      accAddress, this.state.accounts.get(accAddress)
    );
    return this.runtime.assertAppDefined(appId, account.getApp(appId));
  }

  // transfer ALGO as per transaction parameters
  transferAlgo (txnParam: AlgoTransferParam): void {
    const fromAccount = this.getAccount(getFromAddress(txnParam));
    const toAccount = this.getAccount(txnParam.toAccountAddr);
    txnParam.amountMicroAlgos = BigInt(txnParam.amountMicroAlgos);

    this.assertMinBalance(txnParam.amountMicroAlgos, fromAccount.address);
    fromAccount.amount -= txnParam.amountMicroAlgos; // remove 'x' algo from sender
    toAccount.amount += txnParam.amountMicroAlgos; // add 'x' algo to receiver

    if (txnParam.payFlags.closeRemainderTo) {
      const closeRemToAcc = this.getAccount(txnParam.payFlags.closeRemainderTo);

      closeRemToAcc.amount += fromAccount.amount; // transfer funds of sender to closeRemTo account
      fromAccount.amount = 0n; // close sender's account
    }
  }

  /**
   * Deduct transaction fee from sender account.
   * @param sender Sender address
   * @param index Index of current tx being processed in tx group
   */
  deductFee (sender: AccountAddress, index: number): void {
    const fromAccount = this.getAccount(sender);
    const fee = BigInt(this.gtxs[index].fee);
    this.assertMinBalance(fee, sender);
    fromAccount.amount -= fee; // remove tx fee from Sender's account
  }

  // transfer ASSET as per transaction parameters
  transferAsset (txnParam: AssetTransferParam): void {
    const fromAccountAddr = getFromAddress(txnParam);
    const fromAssetHolding = this.getAssetHolding(txnParam.assetID, fromAccountAddr);
    const toAssetHolding = this.getAssetHolding(txnParam.assetID, txnParam.toAccountAddr);
    txnParam.amount = BigInt(txnParam.amount);

    if (txnParam.amount !== 0n) {
      this.assertAssetNotFrozen(txnParam.assetID, fromAccountAddr);
      this.assertAssetNotFrozen(txnParam.assetID, txnParam.toAccountAddr);
    }
    if (fromAssetHolding.amount - txnParam.amount < 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS, {
        amount: txnParam.amount,
        address: fromAccountAddr
      });
    }
    fromAssetHolding.amount -= txnParam.amount;
    toAssetHolding.amount += txnParam.amount;

    if (txnParam.payFlags.closeRemainderTo) {
      const closeRemToAssetHolding = this.getAssetHolding(
        txnParam.assetID, txnParam.payFlags.closeRemainderTo);

      closeRemToAssetHolding.amount += fromAssetHolding.amount; // transfer assets of sender to closeRemTo account
      fromAssetHolding.amount = 0n; // close sender's account
    }
  }

  /**
   * https://developer.algorand.org/docs/features/asa/#modifying-an-asset
   * Modifies asset fields
   * @param assetId Asset Index
   * @param fields Asset modifying fields
   */
  modifyAsset (assetId: number, fields: AssetModFields): void {
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
   * @param appId Application Index
   */
  deleteApp (appId: number): void {
    if (!this.state.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    const accountAddr = this.runtime.assertAddressDefined(this.state.globalApps.get(appId));
    if (accountAddr === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST);
    }
    const account = this.runtime.assertAccountDefined(
      accountAddr, this.state.accounts.get(accountAddr)
    );

    account.deleteApp(appId);
    this.state.globalApps.delete(appId);
  }

  /**
   * Closes application from account's state
   * @param sender Sender address
   * @param appId application index
   */
  closeApp (sender: AccountAddress, appId: number): void {
    const fromAccount = this.getAccount(sender);
    // https://developer.algorand.org/docs/reference/cli/goal/app/closeout/#search-overlay
    this.runtime.assertAppDefined(appId, this.getApp(appId));
    fromAccount.closeApp(appId); // remove app from local state
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
  processTransactions (txnParams: ExecParams[]): void {
    txnParams.forEach((txnParam, idx) => {
      const fromAccountAddr = getFromAddress(txnParam);
      this.deductFee(fromAccountAddr, idx);

      if (txnParam.sign === SignType.LogicSignature) {
        this.tx = this.gtxs[idx]; // update current tx to index of stateless
        this.runtime.validateLsigAndRun(txnParam);
        this.tx = this.gtxs[0]; // after executing stateless tx updating current tx to default (index 0)
      }

      // https://developer.algorand.org/docs/features/asc1/stateful/#the-lifecycle-of-a-stateful-smart-contract
      switch (txnParam.type) {
        case TransactionType.TransferAlgo: {
          this.transferAlgo(txnParam);
          break;
        }
        case TransactionType.TransferAsset: {
          this.transferAsset(txnParam);
          break;
        }
        case TransactionType.CallNoOpSSC: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txnParam.appId);
          this.runtime.run(appParams[approvalProgram], ExecutionMode.STATEFUL);
          break;
        }
        case TransactionType.CloseSSC: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txnParam.appId);
          this.runtime.run(appParams[approvalProgram], ExecutionMode.STATEFUL);
          this.closeApp(fromAccountAddr, txnParam.appId);
          break;
        }
        case TransactionType.ClearSSC: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.runtime.assertAppDefined(txnParam.appId, this.getApp(txnParam.appId));
          try {
            this.runtime.run(appParams["clear-state-program"], ExecutionMode.STATEFUL);
          } catch (error) {
            // if transaction type is Clear Call, remove the app without throwing error (rejecting tx)
            // tested by running on algorand network
            // https://developer.algorand.org/docs/features/asc1/stateful/#the-lifecycle-of-a-stateful-smart-contract
          }

          this.closeApp(fromAccountAddr, txnParam.appId); // remove app from local state
          break;
        }
        case TransactionType.DeleteSSC: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txnParam.appId);
          this.runtime.run(appParams[approvalProgram], ExecutionMode.STATEFUL);
          this.deleteApp(txnParam.appId);
          break;
        }
        case TransactionType.ModifyAsset: {
          const asset = this.getAssetDef(txnParam.assetID);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          // modify asset in ctx.
          this.modifyAsset(txnParam.assetID, txnParam.fields);
          break;
        }
        case TransactionType.FreezeAsset: {
          const asset = this.getAssetDef(txnParam.assetID);
          if (asset.freeze !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.FREEZE_ERROR, { address: asset.freeze });
          }
          this.freezeAsset(txnParam.assetID, txnParam.freezeTarget, txnParam.freezeState);
          break;
        }
        case TransactionType.RevokeAsset: {
          const asset = this.getAssetDef(txnParam.assetID);
          if (asset.clawback !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.CLAWBACK_ERROR, { address: asset.clawback });
          }
          if (txnParam.payFlags.closeRemainderTo) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CLAWBACK);
          }
          this.revokeAsset(
            txnParam.recipient, txnParam.assetID,
            txnParam.revocationTarget, BigInt(txnParam.amount)
          );
          break;
        }
        case TransactionType.DestroyAsset: {
          const asset = this.getAssetDef(txnParam.assetID);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          this.destroyAsset(txnParam.assetID);
          break;
        }
      }
    });
  }
}
