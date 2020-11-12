import type { Account as AccountSDK, ConfirmedTxInfo } from "algosdk";
import tx from "algosdk";

import { AlgobDeployer, TxParams } from "../types";
import { mkSuggestedParams } from "./tx";

/**
 * Description: NoOp - Generic application calls to execute the ApprovalProgram
 * @param deployer AlgobDeployer
 * @param sender Account from which call needs to be made
 * @param payFlags Transaction Flags
 * @param appId ID of the application being configured or empty if creating
 */
export async function callNoOp (
  deployer: AlgobDeployer,
  sender: AccountSDK,
  payFlags: TxParams,
  appId: number,
  appArgs?: Uint8Array[],
  accounts?: string,
  foreignApps?: string,
  foreignAssets?: string,
  note?: Uint8Array,
  lease?: Uint8Array,
  rekeyTo?: string
): Promise<void> {
  const params = await mkSuggestedParams(deployer.algodClient, payFlags);
  const txn = tx.makeApplicationNoOpTxn(
    sender.addr,
    params,
    appId,
    appArgs,
    accounts,
    foreignApps,
    foreignAssets,
    note,
    lease,
    rekeyTo);

  const txId = txn.txID().toString();
  const signedTxn = txn.signTxn(sender.sk);
  await deployer.algodClient.sendRawTransaction(signedTxn).do();
  const transactionResponse = await deployer.waitForConfirmation(txId);

  console.log("Called app-id:", appId);
  if (transactionResponse['global-state-delta'] !== undefined) {
    console.log("Global State updated:", transactionResponse['global-state-delta']);
  }
  if (transactionResponse['local-state-delta'] !== undefined) {
    console.log("Local State updated:", transactionResponse['local-state-delta']);
  }
}

/**
 * Description: Transaction to update TEAL Programs for a contract.
 * @param deployer AlgobDeployer
 * @param sender Account from which call needs to be made
 * @param payFlags Transaction Flags
 * @param appId ID of the application being configured or empty if creating
 * @param newApprovalProgram New Approval Program filename
 * @param newClearProgram New Clear Program filename
 */
export async function update (
  deployer: AlgobDeployer,
  sender: AccountSDK,
  payFlags: TxParams,
  appId: number,
  newApprovalProgram: string,
  newClearProgram: string,
  appArgs?: Uint8Array[]
): Promise<ConfirmedTxInfo> {
  const params = await mkSuggestedParams(deployer.algodClient, payFlags);

  const app = await deployer.ensureCompiled(newApprovalProgram, false);
  const approvalProg = new Uint8Array(Buffer.from(app.compiled, "base64"));
  const clear = await deployer.ensureCompiled(newClearProgram, false);
  const clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));

  const txn = tx.makeApplicationUpdateTxn(sender.addr, params, appId, approvalProg, clearProg, appArgs);

  const txId = txn.txID().toString();
  const signedTxn = txn.signTxn(sender.sk);
  await deployer.algodClient.sendRawTransaction(signedTxn).do();
  return await deployer.waitForConfirmation(txId);
}

/**
 * Description: The user may discontinue use of the application by sending a close out transaction (Opt Out).
 * This will remove the local state for this application from the user's account.
 * @param deployer AlgobDeployer
 * @param sender Account from which call needs to be made
 * @param payFlags Transaction Flags
 * @param appId ID of the application being configured or empty if creating
 */
export async function closeOut (
  deployer: AlgobDeployer,
  sender: AccountSDK,
  payFlags: TxParams,
  appId: number
): Promise<void> {
  const params = await mkSuggestedParams(deployer.algodClient, payFlags);

  const txn = tx.makeApplicationCloseOutTxn(sender.addr, params, appId);

  const txId = txn.txID().toString();
  const signedTxn = txn.signTxn(sender.sk);
  await deployer.algodClient.sendRawTransaction(signedTxn).do();
  await deployer.waitForConfirmation(txId);
}

/**
 * Description: The approval program defines the creator as the only account able to delete the application.
 * This removes the global state, but does not impact any user's local state.
 * @param deployer AlgobDeployer
 * @param sender Account from which call needs to be made
 * @param payFlags Transaction Flags
 * @param appId ID of the application being configured or empty if creating
 */
export async function deleteApplication (
  deployer: AlgobDeployer,
  sender: AccountSDK,
  payFlags: TxParams,
  appId: number
): Promise<void> {
  const params = await mkSuggestedParams(deployer.algodClient, payFlags);

  const txn = tx.makeApplicationDeleteTxn(sender.addr, params, appId);

  const txId = txn.txID().toString();
  const signedTxn = txn.signTxn(sender.sk);
  await deployer.algodClient.sendRawTransaction(signedTxn).do();
  await deployer.waitForConfirmation(txId);
}

/**
 * Description: The user may clear the local state for an application at any time,
 * even if the application was deleted by the creator.
 * @param deployer AlgobDeployer
 * @param sender Account from which call needs to be made
 * @param payFlags Transaction Flags
 * @param appId ID of the application being configured or empty if creating
 */
export async function clearUserState (
  deployer: AlgobDeployer,
  sender: AccountSDK,
  payFlags: TxParams,
  appId: number
): Promise<void> {
  const params = await mkSuggestedParams(deployer.algodClient, payFlags);
  const txn = tx.makeApplicationClearStateTxn(sender.addr, params, appId);

  const txId = txn.txID().toString();
  const signedTxn = txn.signTxn(sender.sk);
  await deployer.algodClient.sendRawTransaction(signedTxn).do();
  await deployer.waitForConfirmation(txId);
}
