import { AssetDef, makeAssetTransferTxnWithSuggestedParams } from "algosdk";

import { getFromAddress, Runtime } from ".";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { mockSuggestedParams } from "./mock/tx";
import {
  AccountAddress, AccountStoreI, AlgoTransferParam, ASADeploymentFlags, AssetHoldingM, AssetModFields,
  AssetTransferParam, Context, ExecParams, ExecutionMode,
  SignType, SSCAttributesM, SSCDeploymentFlags, SSCOptionalFlags,
  State, TransactionType, Txn, TxParams, UpdateSSCParam
} from "./types";

const APPROVAL_PROGRAM = "approval-program";

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
   * Add Asset
   * @param name ASA name
   * @param fromAccountAddr account address of creator
   * @param flags ASA Deployment Flags
   */
  addAsset (name: string, fromAccountAddr: AccountAddress, flags: ASADeploymentFlags): number {
    const senderAcc = this.getAccount(fromAccountAddr);

    // create asset
    const asset = senderAcc.addAsset(
      ++this.state.assetCounter, name,
      this.runtime.loadedAssetsDefs[name]
    );
    this.runtime.mkAssetCreateTx(name, flags, asset);

    this.state.assetDefs.set(this.state.assetCounter, senderAcc.address);
    this.state.assetNameInfo.set(name, {
      creator: senderAcc.address,
      assetIndex: this.state.assetCounter,
      assetDef: asset,
      txId: this.tx.txID,
      confirmedRound: this.runtime.getRound()
    });

    const payFlags: TxParams = {
      feePerByte: flags.feePerByte,
      totalFee: flags.totalFee,
      firstValid: flags.firstValid,
      validRounds: flags.validRounds,
      lease: flags.lease,
      note: flags.note,
      noteb64: flags.noteb64,
      closeRemainderTo: flags.closeRemainderTo,
      rekeyTo: flags.rekeyTo
    };
    this.optIntoASA(this.state.assetCounter, senderAcc.address, payFlags); // opt-in for creator
    return this.state.assetCounter;
  }

  /**
   * Asset Opt-In for account in context
   * @param assetIndex Asset Index
   * @param address Account address to opt-into asset
   * @param flags Transaction Parameters
   */
  optIntoASA (assetIndex: number, address: AccountAddress, flags: TxParams): void {
    const assetDef = this.getAssetDef(assetIndex);
    const creatorAddr = assetDef.creator;
    makeAssetTransferTxnWithSuggestedParams(
      address, address, undefined, undefined, 0, undefined, assetIndex,
      mockSuggestedParams(flags, this.runtime.getRound()));

    const assetHolding: AssetHoldingM = {
      amount: address === creatorAddr ? BigInt(assetDef.total) : 0n, // for creator opt-in amount is total assets
      'asset-id': assetIndex,
      creator: creatorAddr,
      'is-frozen': address === creatorAddr ? false : assetDef.defaultFrozen
    };

    const account = this.getAccount(address);
    account.optInToASA(assetIndex, assetHolding);
  }

  /**
   * creates new application and returns application id
   * @param fromAccountAddr creator account address
   * @param flags SSCDeployment flags
   * @param approvalProgram application approval program
   * @param clearProgram application clear program
   * NOTE - approval and clear program must be the TEAL code as string (not compiled code)
   */
  addApp (
    fromAccountAddr: AccountAddress, flags: SSCDeploymentFlags,
    approvalProgram: string, clearProgram: string
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
    this.state.accounts.set(senderAcc.address, senderAcc);
    this.state.globalApps.set(app.id, senderAcc.address);

    this.runtime.run(approvalProgram, ExecutionMode.STATEFUL); // execute TEAL code with appId = 0

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
        txId: this.tx.txID,
        confirmedRound: this.runtime.getRound(),
        timestamp: Math.round(+new Date() / 1000)
      }
    );

    return this.state.appCounter;
  }

  /**
   * Account address opt-in for application Id
   * @param accountAddr Account address
   * @param appId Application Id
   */
  optInToApp (accountAddr: AccountAddress, appID: number): void {
    const appParams = this.getApp(appID);

    const account = this.getAccount(accountAddr);
    account.optInToApp(appID, appParams);
    this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.STATEFUL);
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
    const fromAssetHolding = this.getAssetHolding(txnParam.assetID as number, fromAccountAddr);
    const toAssetHolding = this.getAssetHolding(txnParam.assetID as number, txnParam.toAccountAddr);
    txnParam.amount = BigInt(txnParam.amount);

    if (txnParam.amount !== 0n) {
      this.assertAssetNotFrozen(txnParam.assetID as number, fromAccountAddr);
      this.assertAssetNotFrozen(txnParam.assetID as number, txnParam.toAccountAddr);
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
      const closeToAddr = txnParam.payFlags.closeRemainderTo;
      if (fromAccountAddr === fromAssetHolding.creator) {
        throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CREATOR);
      }
      this.assertAssetNotFrozen(txnParam.assetID as number, closeToAddr);

      const closeRemToAssetHolding = this.getAssetHolding(
        txnParam.assetID as number, closeToAddr);

      closeRemToAssetHolding.amount += fromAssetHolding.amount; // transfer assets of sender to closeRemTo account
      this.getAccount(fromAccountAddr).assets.delete(txnParam.assetID as number); // remove asset holding from sender account
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
   * Update application
   * @param appId application Id
   * @param approvalProgram new approval program
   * @param clearProgram new clear program
   * NOTE - approval and clear program must be the TEAL code as string
   */
  updateApp (
    appID: number,
    approvalProgram: string,
    clearProgram: string
  ): void {
    if (approvalProgram === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM);
    }
    if (clearProgram === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM);
    }

    const appParams = this.getApp(appID);
    this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.STATEFUL);

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
          this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.STATEFUL);
          break;
        }
        case TransactionType.CloseSSC: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txnParam.appId);
          this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.STATEFUL);
          this.closeApp(fromAccountAddr, txnParam.appId);
          break;
        }
        case TransactionType.UpdateSSC: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index

          this.updateApp(
            txnParam.appID, txnParam.newApprovalProgram, txnParam.newClearProgram
          );
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
          this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.STATEFUL);
          this.deleteApp(txnParam.appId);
          break;
        }
        case TransactionType.ModifyAsset: {
          const asset = this.getAssetDef(txnParam.assetID as number);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          // modify asset in ctx.
          this.modifyAsset(txnParam.assetID as number, txnParam.fields);
          break;
        }
        case TransactionType.FreezeAsset: {
          const asset = this.getAssetDef(txnParam.assetID as number);
          if (asset.freeze !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.FREEZE_ERROR, { address: asset.freeze });
          }
          this.freezeAsset(txnParam.assetID as number, txnParam.freezeTarget, txnParam.freezeState);
          break;
        }
        case TransactionType.RevokeAsset: {
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
        case TransactionType.DestroyAsset: {
          const asset = this.getAssetDef(txnParam.assetID as number);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          this.destroyAsset(txnParam.assetID as number);
          break;
        }
        case TransactionType.DeployASA: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const senderAcc = this.getAccount(fromAccountAddr);
          const name = txnParam.asaName;
          const flags: ASADeploymentFlags = {
            ...txnParam.payFlags,
            creator: { ...senderAcc.account, name: senderAcc.address }
          };

          this.addAsset(name, fromAccountAddr, flags);
          break;
        }
        case TransactionType.OptInASA: {
          this.optIntoASA(txnParam.assetID as number, fromAccountAddr, txnParam.payFlags);
          break;
        }
        case TransactionType.DeploySSC: {
          const senderAcc = this.getAccount(fromAccountAddr);
          const flags: SSCDeploymentFlags = {
            sender: senderAcc.account,
            localInts: txnParam.localInts,
            localBytes: txnParam.localBytes,
            globalInts: txnParam.globalInts,
            globalBytes: txnParam.globalBytes
          };
          this.tx = this.gtxs[idx]; // update current tx to the requested index

          this.addApp(
            fromAccountAddr, flags,
            txnParam.approvalProgram,
            txnParam.approvalProgram
          );
          break;
        }
        case TransactionType.OptInSSC: {
          this.tx = this.gtxs[idx]; // update current tx to txn being exectuted in group

          this.optInToApp(fromAccountAddr, txnParam.appID);
          break;
        }
      }
    });
  }
}
