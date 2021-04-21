import algosdk from "algosdk";
import fs from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { loadSignedTxnFromFile } from "../lib/files";
import { signMultiSig } from "../lib/msig";
import { RuntimeEnv } from "../types";
import { writeToFile } from "./gen-accounts";
import { TASK_SIGN_MULTISIG } from "./task-names";

export interface TaskArgs {
  file: string
  accountName: string
  out?: string
  force?: boolean
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
  const txFile = loadSignedTxnFromFile(taskArgs.file);
  if (txFile === undefined) {
    console.error("Error loading transaction from the file.");
    return;
  }
  const tx = algosdk.decodeObj(txFile);
  if (!tx.blob) {
    console.error("The decoded transaction doesn't appear to be a signed transaction.");
    return;
  }
  const signedTxn = signMultiSig(signerAccount, tx);
  let outFileName = taskArgs.file.split(".")[0] + "_out.txn";
  if (taskArgs.out) {
    if (fs.pathExistsSync(taskArgs.out)) {
      console.log("Provided output path exists. Using default value for output.");
    } else {
      outFileName = taskArgs.out;
    }
  }
  await writeToFile(algosdk.encodeObj(signedTxn), taskArgs.force, outFileName);
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
    .addFlag("force", "Overwrite output transaction file if the file already exists.")
    .setAction((input, env) => multiSignTx(input, env));
}
