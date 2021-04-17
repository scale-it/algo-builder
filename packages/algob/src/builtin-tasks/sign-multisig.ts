import algosdk from "algosdk";
import fs from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { loadRawSignedTxnFromFile, writeToFile } from "../lib/files";
import { signMultiSig } from "../lib/msig";
import { RuntimeEnv } from "../types";
import { TASK_SIGN_MULTISIG } from "./task-names";

export interface TaskArgs {
  file: string
  accountName: string
  out: string
}

async function multiSignTx (
  taskArgs: TaskArgs,
  runtimeEnv: RuntimeEnv
): Promise<void> {
  const signerAccount = runtimeEnv.network.config.accounts.find(acc => acc.name === taskArgs.accountName);
  if (signerAccount === undefined) {
    console.error("No account with the name \"%s\" exists in the config file.", taskArgs.accountName);
    return;
  }
  const txFile = loadRawSignedTxnFromFile(taskArgs.file);
  const tx = algosdk.decodeObj(txFile);
  if (!tx.blob) {
    console.error("The decoded transaction doesn't appear to be a signed transaction.");
    return;
  }
  const signedTxn = signMultiSig(signerAccount, tx);
  let outFileName = taskArgs.file.slice(0, -4) + "_out.txn";
  if (taskArgs.out) {
    if (fs.pathExistsSync(taskArgs.out)) {
      console.log("Provided output path exists. Using default value for output.");
    } else {
      outFileName = taskArgs.out;
    }
  }
  writeToFile(outFileName, algosdk.encodeObj(signedTxn));
  console.log("Signed transaction written succesfully to %s", outFileName);
}

export default function (): void {
  task(TASK_SIGN_MULTISIG, "Signs a transaction object from a file using Multi Signature")
    .addParam(
      "accountName",
      "Name of the account (present in `algob.config.js`) to be used for signing the transaction."
    )
    .addParam(
      "file",
      "Name of the transaction file in assets directory"
    )
    .addOptionalParam(
      "out",
      "Name of the file to be used for resultant transaction file.\n\t\t        If not provided source transaction file's name will be appended by \"_out\""
    )
    .setAction((input, env) => multiSignTx(input, env));
}
