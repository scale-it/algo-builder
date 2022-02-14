import { tx as webTx, types } from "@algo-builder/web";
import { getApplicationAddress, makeAssetTransferTxnWithSuggestedParams, modelsv2 } from "algosdk";

import { AccountStore, getProgram, parseASADef, Runtime } from ".";
import { RuntimeAccount } from "./account";
import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { validateOptInAccNames } from "./lib/asa";
import { ALGORAND_MIN_TX_FEE } from "./lib/constants";
import { pyExt, tealExt } from "./lib/pycompile-op";
import { mockSuggestedParams } from "./mock/tx";
import {
  AccountAddress, AccountStoreI,
  AppDeploymentFlags,
  ASADeploymentFlags, AssetHoldingM,
  Context, DeployedAppTxReceipt, DeployedAssetTxReceipt, EncTx, ExecutionMode,
  ID, SCParams, SSCAttributesM, StackElem, State, TxReceipt
} from "./types";

const APPROVAL_PROGRAM = "approval-program";

export class Ctx implements Context {
  state: State;
  tx: EncTx;
  gtxs: EncTx[];
  args: Uint8Array[];
  runtime: Runtime;
  debugStack?: number; //  max number of top elements from the stack to print after each opcode execution.
  sharedScratchSpace: Map<number, StackElem[]>; // here number is index of transaction in a group
  knowableID: Map<number, ID>; // here number is index of transaction in a group
  pooledApplCost: number; // total opcode cost for each application call for single/group tx
  // inner transaction props
  isInnerTx: boolean; // true if "ctx" is switched to an inner transaction
  createdAssetID: number; // Asset ID allocated by the creation of an ASA (for an inner-tx)

  constructor (state: State, tx: EncTx, gtxs: EncTx[], args: Uint8Array[],
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
    this.pooledApplCost = 0;
    // inner transaction props
    this.isInnerTx = false;
    this.createdAssetID = 0;
  }

  private setAndGetTxReceipt (): TxReceipt {
    const info = { txn: this.tx, txID: this.tx.txID };
    this.state.txReceipts.set(this.tx.txID, info);
    return info;
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
  transferAlgo (txParam: types.AlgoTransferParam): TxReceipt {
    const fromAccount = this.getAccount(webTx.getFromAddress(txParam));
    const toAccount = this.getAccount(txParam.toAccountAddr);
    txParam.amountMicroAlgos = BigInt(txParam.amountMicroAlgos);

    fromAccount.amount -= txParam.amountMicroAlgos; // remove 'x' algo from sender
    toAccount.amount += BigInt(txParam.amountMicroAlgos); // add 'x' algo to receiver
    this.assertAccBalAboveMin(fromAccount.address);

    if (txParam.payFlags.closeRemainderTo) {
      this.verifyCloseRemainderTo(txParam);
      const closeRemToAcc = this.getAccount(txParam.payFlags.closeRemainderTo);

      closeRemToAcc.amount += fromAccount.amount; // transfer funds of sender to closeRemTo account
      fromAccount.amount = 0n; // close sender's account
    }
    return this.setAndGetTxReceipt();
  }

  /**
   * Deploy asset using asa.yaml file
   * @param name asset name
   * @param fromAccountAddr account address
   * @param flags asa deployment flags
   */
  deployASA (
    name: string,
    fromAccountAddr: AccountAddress, flags: ASADeploymentFlags
  ): DeployedAssetTxReceipt {
    return this.deployASADef(
      name, this.runtime.loadedAssetsDefs[name], fromAccountAddr, flags
    );
  }

  /**
   * Deploy Asset without using asa.yaml file
   * @param name ASA name
   * @param asaDef asset defitions
   * @param fromAccountAddr account address of creator
   * @param flags ASA Deployment Flags
   */
  deployASADef (
    name: string, asaDef: types.ASADef,
    fromAccountAddr: AccountAddress, flags: ASADeploymentFlags
  ): DeployedAssetTxReceipt {
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

    if (this.isInnerTx) { this.createdAssetID = this.state.assetCounter; }

    // set & return transaction receipt
    const receipt = {
      txn: this.tx,
      txID: this.tx.txID,
      assetID: this.state.assetCounter
    };
    this.state.txReceipts.set(this.tx.txID, receipt);
    return receipt;
  }

  /**
   * Asset Opt-In for account in context
   * @param assetIndex Asset Index
   * @param address Account address to opt-into asset
   * @param flags Transaction Parameters
   */
  optIntoASA (assetIndex: number, address: AccountAddress, flags: types.TxParams): TxReceipt {
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
    return this.setAndGetTxReceipt();
  }

  /**
   * deploy a new application and returns application id
   * @param fromAccountAddr creator account address
   * @param flags SSCDeployment flags
   * @param approvalProgram application approval program (TEAL code or program filename)
   * @param clearProgram application clear program (TEAL code or program filename)
   * @param idx index of transaction in group
   * @param scTmplParams Smart Contract template parameters
   * NOTE When creating or opting into an app, the minimum balance grows before the app code runs
   */
  deployApp (
    fromAccountAddr: AccountAddress, flags: AppDeploymentFlags,
    approvalProgram: string, clearProgram: string, idx: number,
    scTmplParams?: SCParams
  ): DeployedAppTxReceipt {
    const senderAcc = this.getAccount(fromAccountAddr);

    const approvalProgTEAL =
      (approvalProgram.endsWith(tealExt) || approvalProgram.endsWith(pyExt))
        ? getProgram(approvalProgram, scTmplParams)
        : approvalProgram;

    const clearProgTEAL =
      (clearProgram.endsWith(tealExt) || clearProgram.endsWith(pyExt))
        ? getProgram(clearProgram, scTmplParams)
        : clearProgram;

    if (approvalProgTEAL === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM);
    }
    if (clearProgTEAL === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM);
    }

    // create app with id = 0 in globalApps for teal execution
    const app = senderAcc.addApp(0, flags, approvalProgTEAL, clearProgTEAL);
    this.assertAccBalAboveMin(senderAcc.address);
    this.state.accounts.set(senderAcc.address, senderAcc);
    this.state.globalApps.set(app.id, senderAcc.address);

    this.runtime.run(
      approvalProgTEAL, ExecutionMode.APPLICATION, idx, this.debugStack
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

    const acc = new AccountStore(
      0,
      new RuntimeAccount({
        addr: getApplicationAddress(this.state.appCounter),
        sk: new Uint8Array(0)
      })
    );
    this.state.accounts.set(acc.address, acc);

    // set & return transaction receipt
    const receipt = this.state.txReceipts.get(this.tx.txID) as DeployedAppTxReceipt;
    receipt.appID = this.state.appCounter;
    return receipt;
  }

  /**
   * Account address opt-in for application Id
   * @param accountAddr Account address to opt into application
   * @param appID Application index
   * @param idx index of transaction in group
   * NOTE: When creating or opting into an app, the minimum balance grows before the app code runs
   */
  optInToApp (accountAddr: AccountAddress, appID: number, idx: number): TxReceipt {
    const appParams = this.getApp(appID);

    const account = this.getAccount(accountAddr);
    account.optInToApp(appID, appParams);
    this.assertAccBalAboveMin(accountAddr);
    try {
      return this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
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
    if (this.isInnerTx) { return; } // pooled fee for inner tx is calculated at itx_submit
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
  * Verify closeRemainderTo field is different than fromAccountAddr
  * @param txParam transaction param
  */
  verifyCloseRemainderTo (txParam: types.ExecParams): void {
    if (!txParam.payFlags.closeRemainderTo) return;
    if (txParam.payFlags.closeRemainderTo === webTx.getFromAddress(txParam)) {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLOSE_REMAINDER_TO);
    }
  }

  /**
   * Deduct transaction fee from sender account.
   * @param sender Sender address
   * @param index Index of current tx being processed in tx group
   */
  deductFee (sender: AccountAddress, index: number, params: types.TxParams): void {
    let fee: bigint = BigInt(this.gtxs[index].fee ?? 0);
    // If flatFee boolean is not set, change fee value
    if (!params.flatFee && params.totalFee === undefined) {
      fee = BigInt(Math.max(ALGORAND_MIN_TX_FEE, Number(this.gtxs[index].fee)));
    }
    const fromAccount = this.getAccount(sender);
    fromAccount.amount -= fee; // remove tx fee from Sender's account
    this.assertAccBalAboveMin(fromAccount.address);
  }

  // transfer ASSET as per transaction parameters
  transferAsset (txParam: types.AssetTransferParam): TxReceipt {
    const fromAccountAddr = webTx.getFromAddress(txParam);
    txParam.amount = BigInt(txParam.amount);
    if (txParam.amount === 0n && fromAccountAddr === txParam.toAccountAddr) {
      this.optIntoASA(txParam.assetID as number, fromAccountAddr, txParam.payFlags);
    } else if (txParam.amount !== 0n) {
      this.assertAssetNotFrozen(txParam.assetID as number, fromAccountAddr);
      this.assertAssetNotFrozen(txParam.assetID as number, txParam.toAccountAddr);
    }

    const fromAssetHolding = this.getAssetHolding(txParam.assetID as number, fromAccountAddr);
    const toAssetHolding = this.getAssetHolding(txParam.assetID as number, txParam.toAccountAddr);
    if (fromAssetHolding.amount - txParam.amount < 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_ASSETS, {
        amount: txParam.amount,
        address: fromAccountAddr
      });
    }
    fromAssetHolding.amount -= txParam.amount;
    toAssetHolding.amount += BigInt(txParam.amount);

    if (txParam.payFlags.closeRemainderTo) {
      this.verifyCloseRemainderTo(txParam);

      const closeToAddr = txParam.payFlags.closeRemainderTo;
      if (fromAccountAddr === fromAssetHolding.creator) {
        throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CREATOR);
      }
      this.assertAssetNotFrozen(txParam.assetID as number, closeToAddr);

      const closeRemToAssetHolding = this.getAssetHolding(
        txParam.assetID as number, closeToAddr);

      closeRemToAssetHolding.amount += fromAssetHolding.amount; // transfer assets of sender to closeRemTo account
      const fromAccount = this.getAccount(fromAccountAddr);
      fromAccount.closeAsset(txParam.assetID as number);
    }
    return this.setAndGetTxReceipt();
  }

  /**
   * https://developer.algorand.org/docs/features/asa/#modifying-an-asset
   * Modifies asset fields
   * @param assetId Asset Index
   * @param fields Asset modifying fields
   */
  modifyAsset (assetId: number, fields: types.AssetModFields): TxReceipt {
    const creatorAcc = this.getAssetAccount(assetId);
    creatorAcc.modifyAsset(assetId, fields);
    return this.setAndGetTxReceipt();
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
  ): TxReceipt {
    const acc = this.runtime.assertAccountDefined(
      freezeTarget,
      this.state.accounts.get(freezeTarget)
    );
    acc.setFreezeState(assetId, freezeState);
    return this.setAndGetTxReceipt();
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
  ): TxReceipt {
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
    return this.setAndGetTxReceipt();
  }

  /**
   * https://developer.algorand.org/docs/features/asa/#destroying-an-asset
   * Destroy asset
   * @param assetId asset index
   */
  destroyAsset (assetId: number): TxReceipt {
    const creatorAcc = this.getAssetAccount(assetId);
    // destroy asset from creator's account
    creatorAcc.destroyAsset(assetId);
    // delete asset holdings from all accounts
    this.state.accounts.forEach((value, key) => {
      value.assets.delete(assetId);
    });
    return this.setAndGetTxReceipt();
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
   * @param approvalProgram new approval program (TEAL code or program filename)
   * @param clearProgram new clear program (TEAL code or program filename)
   * @param idx index of transaction in group
   * @param scTmplParams Smart Contract template parameters
   */
  updateApp (
    appID: number,
    approvalProgram: string,
    clearProgram: string,
    idx: number,
    scTmplParams?: SCParams
  ): TxReceipt {
    const approvalProgTEAL =
      (approvalProgram.endsWith(tealExt) || approvalProgram.endsWith(pyExt))
        ? getProgram(approvalProgram, scTmplParams)
        : approvalProgram;

    const clearProgTEAL =
      (clearProgram.endsWith(tealExt) || clearProgram.endsWith(pyExt))
        ? getProgram(clearProgram, scTmplParams)
        : clearProgram;

    if (approvalProgTEAL === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM);
    }
    if (clearProgTEAL === "") {
      throw new RuntimeError(RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM);
    }

    const appParams = this.getApp(appID);
    const txReceipt =
      this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);

    const updatedApp = this.getApp(appID);
    updatedApp[APPROVAL_PROGRAM] = approvalProgTEAL;
    updatedApp["clear-state-program"] = clearProgTEAL;
    return txReceipt;
  }

  // apply rekey config on from account
  rekeyTo (txParam: types.ExecParams): void {
    if (!txParam.payFlags.rekeyTo) return;
    const fromAccount = this.getAccount(webTx.getFromAddress(txParam));
    // apply rekey
    fromAccount.rekeyTo(txParam.payFlags.rekeyTo);
  }

  /**
   * Process transactions in ctx
   * - Runs TEAL code if associated with transaction
   * - Executes the transaction on ctx
   * Note: we're doing this because if any one tx in group fails,
   * then it does not affect runtime.store, otherwise we just update
   * store with ctx (if all transactions are executed successfully).
   * @param txParams Transaction Parameters
   */
  /* eslint-disable sonarjs/cognitive-complexity */
  processTransactions (txParams: types.ExecParams[]): TxReceipt[] {
    const txReceipts: TxReceipt[] = [];
    let r: TxReceipt;

    this.verifyMinimumFees();
    txParams.forEach((txParam, idx) => {
      const fromAccountAddr = webTx.getFromAddress(txParam);
      this.deductFee(fromAccountAddr, idx, txParam.payFlags);

      if (txParam.sign === types.SignType.LogicSignature) {
        this.tx = this.gtxs[idx]; // update current tx to index of stateless
        r = this.runtime.validateLsigAndRun(txParam, this.debugStack);
        this.tx = this.gtxs[0]; // after executing stateless tx updating current tx to default (index 0)
      } else if (txParam.sign === types.SignType.SecretKey) {
        this.runtime.validateAccountSignature(txParam);
      }

      // https://developer.algorand.org/docs/features/asc1/stateful/#the-lifecycle-of-a-stateful-smart-contract
      switch (txParam.type) {
        case types.TransactionType.TransferAlgo: {
          // if toAccountAddre doesn't exist in runtime env
          // then we will add it to runtime env.
          if (this.state.accounts.get(txParam.toAccountAddr) === undefined) {
            this.state.accounts.set(
              txParam.toAccountAddr,
              new AccountStore(0, { addr: txParam.toAccountAddr, sk: new Uint8Array(0) })
            );
          }

          r = this.transferAlgo(txParam);
          break;
        }
        case types.TransactionType.TransferAsset: {
          r = this.transferAsset(txParam);
          break;
        }
        case types.TransactionType.CallApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txParam.appID);
          r = this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
          break;
        }
        case types.TransactionType.CloseApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txParam.appID);
          r = this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
          this.closeApp(fromAccountAddr, txParam.appID);
          break;
        }
        case types.TransactionType.UpdateApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index

          r = this.updateApp(
            txParam.appID, txParam.newApprovalProgram, txParam.newClearProgram, idx
          );
          break;
        }
        case types.TransactionType.ClearApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.runtime.assertAppDefined(txParam.appID, this.getApp(txParam.appID));
          try {
            r = this.runtime.run(appParams["clear-state-program"], ExecutionMode.APPLICATION, idx, this.debugStack);
          } catch (error) {
            // if transaction type is Clear Call, remove the app without throwing error (rejecting tx)
            // tested by running on algorand network
            // https://developer.algorand.org/docs/features/asc1/stateful/#the-lifecycle-of-a-stateful-smart-contract
          }

          this.closeApp(fromAccountAddr, txParam.appID); // remove app from local state
          break;
        }
        case types.TransactionType.DeleteApp: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const appParams = this.getApp(txParam.appID);
          r = this.runtime.run(appParams[APPROVAL_PROGRAM], ExecutionMode.APPLICATION, idx, this.debugStack);
          this.deleteApp(txParam.appID);
          break;
        }
        case types.TransactionType.ModifyAsset: {
          const asset = this.getAssetDef(txParam.assetID as number);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          // modify asset in ctx.
          r = this.modifyAsset(txParam.assetID as number, txParam.fields);
          break;
        }
        case types.TransactionType.FreezeAsset: {
          const asset = this.getAssetDef(txParam.assetID as number);
          if (asset.freeze !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.FREEZE_ERROR, { address: asset.freeze });
          }
          r = this.freezeAsset(txParam.assetID as number, txParam.freezeTarget, txParam.freezeState);
          break;
        }
        case types.TransactionType.RevokeAsset: {
          const asset = this.getAssetDef(txParam.assetID as number);
          if (asset.clawback !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.CLAWBACK_ERROR, { address: asset.clawback });
          }
          if (txParam.payFlags.closeRemainderTo) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CLAWBACK);
          }
          r = this.revokeAsset(
            txParam.recipient, txParam.assetID as number,
            txParam.revocationTarget, BigInt(txParam.amount)
          );
          break;
        }
        case types.TransactionType.DestroyAsset: {
          const asset = this.getAssetDef(txParam.assetID as number);
          if (asset.manager !== fromAccountAddr) {
            throw new RuntimeError(RUNTIME_ERRORS.ASA.MANAGER_ERROR, { address: asset.manager });
          }
          r = this.destroyAsset(txParam.assetID as number);
          break;
        }
        case types.TransactionType.DeployASA: {
          this.tx = this.gtxs[idx]; // update current tx to the requested index
          const senderAcc = this.getAccount(fromAccountAddr);
          const flags: ASADeploymentFlags = {
            ...txParam.payFlags,
            creator: { ...senderAcc.account, name: senderAcc.address }
          };
          if (txParam.asaDef) {
            r = this.deployASADef(txParam.asaName, txParam.asaDef, fromAccountAddr, flags);
          } else {
            r = this.deployASA(txParam.asaName, fromAccountAddr, flags);
          }
          this.knowableID.set(idx, (r as DeployedAssetTxReceipt).assetID);
          break;
        }
        case types.TransactionType.OptInASA: {
          r = this.optIntoASA(txParam.assetID as number, fromAccountAddr, txParam.payFlags);
          break;
        }
        case types.TransactionType.DeployApp: {
          const senderAcc = this.getAccount(fromAccountAddr);
          const flags: AppDeploymentFlags = {
            sender: senderAcc.account,
            localInts: txParam.localInts,
            localBytes: txParam.localBytes,
            globalInts: txParam.globalInts,
            globalBytes: txParam.globalBytes
          };
          this.tx = this.gtxs[idx]; // update current tx to the requested index

          r = this.deployApp(
            fromAccountAddr, flags,
            txParam.approvalProgram,
            txParam.clearProgram,
            idx
          );
          this.knowableID.set(idx, (r as DeployedAppTxReceipt).appID);
          break;
        }
        case types.TransactionType.OptInToApp: {
          this.tx = this.gtxs[idx]; // update current tx to tx being exectuted in group

          r = this.optInToApp(fromAccountAddr, txParam.appID, idx);
          break;
        }
      }
      // if closeRemainderTo field occur in txParam
      // we will change rekeyTo field to webTx.getFromAddress(txParam)
      if (txParam.payFlags.closeRemainderTo) {
        txParam.payFlags.rekeyTo = webTx.getFromAddress(txParam);
      }
      // apply rekey after pass all logic
      this.rekeyTo(txParam);

      if (r) { txReceipts.push(r); }
    });

    return txReceipts;
  }
}
