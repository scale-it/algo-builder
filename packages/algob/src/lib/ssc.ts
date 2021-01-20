import tx, { Account as AccountSDK, ConfirmedTxInfo, decodeAddress } from "algosdk";

import { AlgobDeployer, SSCOptionalFlags, TxParams } from "../types";
import { MAX_UINT64, MIN_UINT64 } from "./constants";
import { encodeNote, mkTxParams } from "./tx";

export const reDigit = /^\d+$/;

// verify n is an unsigned 64 bit integer
function assertUint64 (n: bigint): void {
  if (n < MIN_UINT64 || n > MAX_UINT64) {
    throw new Error(`Invalid uint64 ${n}`);
  }
}

/**
 * Converts 64 bit unsigned integer to bytes in big endian.
 */
export function uint64ToBigEndian (x: number | bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  let i = 7;
  x = BigInt(x); // use x as bigint internally to support upto uint64
  assertUint64(x);
  while (x) {
    bytes[i--] = Number(x % 256n);
    x /= 256n;
  }
  return bytes;
}

const throwErr = (appArg: string): void => {
  throw new Error(`Format of arguments passed to stateful smart is invalid for ${appArg}`);
};

/**
 * Parses appArgs to bytes if arguments passed to SSC are similar to goal ('int:1', 'str:hello'..)
 * https://developer.algorand.org/docs/features/asc1/stateful/#passing-arguments-to-stateful-smart-contracts
 * eg. "int:1" => new Uint8Aarray([0, 0, 0, 0, 0, 0, 0, 1])
 * NOTE: parseSSCAppArgs returns undefined to handle the case when application args passed to
 * stateful smart contract is undefined
 * @param appArgs : arguments to stateful smart contract
 */
export function parseSSCAppArgs (appArgs?: Array<Uint8Array | string>): Uint8Array[] | undefined {
  if (appArgs === undefined) { return undefined; }
  const args = [];

  for (const appArg of appArgs) {
    // if appArg already bytes, then we don't need to parse
    // just push to array and continue
    if (appArg instanceof Uint8Array) {
      args.push(appArg);
      continue;
    }
    const [type, value] = appArg.split(':'); // eg "int:1" => ['int', '1']

    // if given string is not invalid, throw error
    if (type === undefined || value === undefined) { throwErr(appArg); }

    // parse string to bytes according to type
    let arg;
    switch (type) {
      case 'int': {
        if (!reDigit.test(value)) { throwErr(appArg); } // verify only digits are present in string
        arg = uint64ToBigEndian(BigInt(value));
        break;
      }
      case 'str': {
        arg = stringToBytes(value);
        break;
      }
      case 'addr': {
        arg = addressToPk(value);
        break;
      }
      case 'b64': {
        arg = new Uint8Array(Buffer.from(value, 'base64'));
        break;
      }
      default: {
        throwErr(appArg);
      }
    }
    args.push(arg);
  };
  return args as Uint8Array[];
}

/**
 * Converts string to bytes.
 * @param s string
 */
export function stringToBytes (s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s));
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
 * @param flags Optional parameters to SSC (accounts, args..)
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
