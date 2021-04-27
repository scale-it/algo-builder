import path from "path";

import { task } from "../internal/core/config/config-env";
import { ASSETS_DIR } from "../internal/core/project-structure";
import { loadSignedTxnFromFile } from "../lib/files";
import { signMultiSig } from "../lib/msig";
import { RuntimeEnv } from "../types";
import { writeToFile } from "./gen-accounts";
import { TASK_SIGN_MULTISIG } from "./task-names";

export interface TaskArgs {
  file: string
  accountName: string
  out?: string
  force: boolean
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
  const rawTxn = loadSignedTxnFromFile(taskArgs.file);
  if (rawTxn === undefined) {
    console.error("Error loading transaction from the file.");
    return;
  }
  const signedTxn = signMultiSig(signerAccount, rawTxn);
  const outFileName = taskArgs.out ?? taskArgs.file.split(".")[0] + "_out.txn";
  const outFilePath = path.join(ASSETS_DIR, outFileName);
  await writeToFile(signedTxn.blob, taskArgs.force, outFilePath);
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
