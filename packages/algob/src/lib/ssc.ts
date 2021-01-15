import tx, { Account as AccountSDK, ConfirmedTxInfo, decodeAddress } from "algosdk";

import { AlgobDeployer, SSCOptionalFlags, TxParams } from "../types";
import { encodeNote, mkTxParams } from "./tx";

/**
 * Converts string to bytes.
 * @param s string
 */
export function stringToBytes (s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s));
}

/**
 * Converts 64 bit unsigned integer to bytes in big endian.
 */
export function uint64ToBigEndian (x: number | bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let i = 0;
  x = BigInt(x); // use x as bigint internally to support upto uint64
  while (x) {
    bytes[i++] = Number(x % 256n);
    x /= 256n;
  }
  return bytes.reverse();
}

/**
 * Parses appArgs to stateful smart contract if arguments are passed similar to goal.
 * eg. "int:1" => new Uint8Aarray([0, 0, 0, 0, 0, 0, 0, 1])
 */
export function parseSSCAppArgs (appArgs?: Array<Uint8Array | string>): Uint8Array[] | undefined {
  return appArgs as Uint8Array[];
}

/**
 * Takes an Algorand address in string form and decodes it into a Uint8Array (as public key)
 * @param addr : algorand address
 */
export function addressToPk (addr: string): Uint8Array {
  return decodeAddress(addr).publicKey;
}

/**
 * Transaction to update TEAL Programs for a contract.
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
  flags: SSCOptionalFlags
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
