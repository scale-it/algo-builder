import { encodeNote, parseSSCAppArgs, types as rtypes } from "@algorand-builder/runtime";
import tx, { Account as AccountSDK, ConfirmedTxInfo } from "algosdk";

import { AlgobDeployer } from "../types";
import { mkTxParams } from "./tx";

export const reDigit = /^\d+$/;

/**
 * Transaction to update TEAL Programs for a contract.
 * @param deployer AlgobDeployer
 * @param sender Account from which call needs to be made
 * @param payFlags Transaction Flags
 * @param appId ID of the application being configured or empty if creating
 * @param newApprovalProgram New Approval Program filename
 * @param newClearProgram New Clear Program filename
 * @param flags Optional parameters to SSC (accounts, args..)
 */
export async function update (
  deployer: AlgobDeployer,
  sender: AccountSDK,
  payFlags: rtypes.TxParams,
  appId: number,
  newApprovalProgram: string,
  newClearProgram: string,
  flags: rtypes.SSCOptionalFlags
): Promise<ConfirmedTxInfo> {
  const params = await mkTxParams(deployer.algodClient, payFlags);
  const note = encodeNote(payFlags.note, payFlags.noteb64);

  const app = await deployer.ensureCompiled(newApprovalProgram, false);
  const approvalProg = new Uint8Array(Buffer.from(app.compiled, "base64"));
  const clear = await deployer.ensureCompiled(newClearProgram, false);
  const clearProg = new Uint8Array(Buffer.from(clear.compiled, "base64"));

  const txn = tx.makeApplicationUpdateTxn(
    sender.addr,
    params,
    appId,
    approvalProg,
    clearProg,
    parseSSCAppArgs(flags.appArgs),
    flags.accounts,
    flags.foreignApps,
    flags.foreignAssets,
    note,
    flags.lease,
    flags.rekeyTo);

  const txId = txn.txID().toString();
  const signedTxn = txn.signTxn(sender.sk);
  await deployer.algodClient.sendRawTransaction(signedTxn).do();
  return await deployer.waitForConfirmation(txId);
}
