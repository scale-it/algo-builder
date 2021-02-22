import { AssetHolding } from "algosdk";

import { Runtime } from ".";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { AccountAddress, AlgoTransferParam, AssetModFields, AssetTransferParam, SSCAttributesM, StoreAccountI } from "./types";

export class Ctx {
  private readonly runtime: Runtime;

  constructor (runtime: Runtime) {
    this.runtime = runtime;
  }

  // verify 'amt' microalgos can be withdrawn from account
  assertMinBalance (amt: number, address: string): void {
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
  getAccount (address: string): StoreAccountI {
    const account = this.runtime.ctx.state.accounts.get(address);
    return this.runtime.assertAccountDefined(address, account);
  }

  /**
   * Returns asset creator account from runtime.ctx or throws error is it doesn't exist
   * @param Asset Index
   */
  getAssetAccount (assetId: number): StoreAccountI {
    const addr = this.runtime.ctx.state.assetDefs.get(assetId);
    if (addr === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND, { assetId: assetId });
    }
    return this.runtime.assertAccountDefined(addr, this.runtime.ctx.state.accounts.get(addr));
  }

  /**
   * Returns Asset Holding from an account
   * @param assetIndex Asset Index
   * @param address address of account to get holding from
   */
  getAssetHolding (assetIndex: number, address: AccountAddress): AssetHolding {
    const account = this.runtime.assertAccountDefined(address, this.runtime.ctx.state.accounts.get(address));
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
   * Fetches app from `this.ctx`
   * @param appId Application Index
   */
  getApp (appId: number): SSCAttributesM {
    if (!this.runtime.ctx.state.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    const accAddress = this.runtime.assertAddressDefined(this.runtime.ctx.state.globalApps.get(appId));
    const account = this.runtime.assertAccountDefined(
      accAddress, this.runtime.ctx.state.accounts.get(accAddress)
    );
    return this.runtime.assertAppDefined(appId, account.getApp(appId));
  }

  // transfer ALGO as per transaction parameters
  transferAlgo (txnParam: AlgoTransferParam): void {
    const fromAccount = this.getAccount(txnParam.fromAccount.addr);
    const toAccount = this.getAccount(txnParam.toAccountAddr);

    this.assertMinBalance(txnParam.amountMicroAlgos, fromAccount.address);
    fromAccount.amount -= txnParam.amountMicroAlgos; // remove 'x' algo from sender
    toAccount.amount += txnParam.amountMicroAlgos; // add 'x' algo to receiver

    if (txnParam.payFlags.closeRemainderTo) {
      const closeRemToAcc = this.getAccount(txnParam.payFlags.closeRemainderTo);

      closeRemToAcc.amount += fromAccount.amount; // transfer funds of sender to closeRemTo account
      fromAccount.amount = 0; // close sender's account
    }
  }

  /**
   * Deduct transaction fee from sender account.
   * @param sender Sender address
   * @param index Index of transaction in tx group
   */
  deductFee (sender: AccountAddress, index: number): void {
    const fromAccount = this.getAccount(sender);
    const fee = this.runtime.ctx.gtxs[index].fee;
    this.assertMinBalance(fee, sender);
    fromAccount.amount -= fee; // remove tx fee from Sender's account
  }

  // transfer ASSET as per transaction parameters
  transferAsset (txnParam: AssetTransferParam): void {
    const fromAssetHolding = this.getAssetHolding(txnParam.assetID, txnParam.fromAccount.addr);
    const toAssetHolding = this.getAssetHolding(txnParam.assetID, txnParam.toAccountAddr);

    this.assertAssetNotFrozen(txnParam.assetID, txnParam.fromAccount.addr);
    this.assertAssetNotFrozen(txnParam.assetID, txnParam.toAccountAddr);
    if (fromAssetHolding.amount - txnParam.amount < 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS, {
        amount: txnParam.amount,
        address: txnParam.fromAccount.addr
      });
    }
    fromAssetHolding.amount -= txnParam.amount;
    toAssetHolding.amount += txnParam.amount;

    if (txnParam.payFlags.closeRemainderTo) {
      const closeRemToAssetHolding = this.getAssetHolding(
        txnParam.assetID, txnParam.payFlags.closeRemainderTo);

      closeRemToAssetHolding.amount += fromAssetHolding.amount; // transfer assets of sender to closeRemTo account
      fromAssetHolding.amount = 0; // close sender's account
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
      this.runtime.ctx.state.accounts.get(freezeTarget)
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
    revocationTarget: string, amount: number
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
   * @param sender sender's address
   * @param assetId asset index
   * @param payFlags transaction parameters
   */
  destroyAsset (assetId: number): void {
    const creatorAcc = this.getAssetAccount(assetId);
    // destroy asset from creator's account
    creatorAcc.destroyAsset(assetId);
    // delete asset holdings from all accounts
    this.runtime.ctx.state.accounts.forEach((value, key) => {
      value.assets.delete(assetId);
    });
  }

  /**
   * Delete application from account's state and global state
   * @param appId Application Index
   */
  deleteApp (appId: number): void {
    if (!this.runtime.ctx.state.globalApps.has(appId)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    const accountAddr = this.runtime.assertAddressDefined(this.runtime.ctx.state.globalApps.get(appId));
    if (accountAddr === undefined) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.ACCOUNT_DOES_NOT_EXIST);
    }
    const account = this.runtime.assertAccountDefined(
      accountAddr, this.runtime.ctx.state.accounts.get(accountAddr)
    );

    account.deleteApp(appId);
    this.runtime.ctx.state.globalApps.delete(appId);
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
}
