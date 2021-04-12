import algosdk from "algosdk";
import fs from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { loadRawSignedTxnFromFile, writeToFile } from "../lib/files";
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
  let signedTxn;
  if (signerAccount === undefined) {
    console.error("No account with the name \"%s\" exists in the config file.", taskArgs.accountName);
    return;
  }
  const txFile = loadRawSignedTxnFromFile(taskArgs.file);
  if (txFile === undefined) {
    throw new Error(`File ${taskArgs.file} does not exist`);
  }
  console.log(txFile);
  const tx = algosdk.decodeObj(txFile);
  if (!tx.blob) {
    console.error("The decoded transaction doesn't appear to be a signed transaction.");
    return;
  }
  const decodedTx = algosdk.decodeSignedTransaction(tx.blob);
  console.debug("Decoded txn from %s: %O", taskArgs.file, decodedTx);
  console.log(decodedTx.msig);
  if (decodedTx.msig) {
    const addresses = [];
    for (var sig of decodedTx.msig.subsig) {
      addresses.push(algosdk.encodeAddress(Uint8Array.from(sig.pk)));
    }
    const mparams = {
      version: decodedTx.msig.v,
      threshold: decodedTx.msig.thr,
      addrs: addresses
    };
    signedTxn = algosdk.appendSignMultisigTransaction(tx.blob, mparams, signerAccount.sk);
    const decodedSignedTxn = algosdk.decodeSignedTransaction(signedTxn.blob);
    console.debug("Decoded txn after successfully signing: %O", decodedSignedTxn);
    console.log(decodedSignedTxn.msig);
  } else {
    console.log("Transaction is not a msig transaction.");
    return;
  }
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
