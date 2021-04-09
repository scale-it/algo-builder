import algosdk from "algosdk";
import fs from "fs-extra";
import path from "path";

import { task } from "../internal/core/config/config-env";
import { ASSETS_DIR } from "../internal/core/project-structure";
import { RuntimeEnv } from "../types";
import { TASK_SIGN_MULTISIG } from "./task-names";

export interface TaskArgs {
  file: string
  account: string
  out: string
}

async function multiSignTx (
  taskArgs: TaskArgs,
  runtimeEnv: RuntimeEnv
): Promise<void> {
  const accounts = runtimeEnv.network.config.accounts;
  let flag = false;
  const signer = {
    addr: "",
    sk: new Uint8Array(0)
  };
  let signedTxn;
  for (var account of accounts) {
    if (account.name === taskArgs.account) {
      flag = true;
      signer.addr = account.addr;
      signer.sk = account.sk;
    }
  }
  if (!flag) {
    console.error("No account with the name \"%s\" exists in the config file.", taskArgs.account);
    return;
  }
  const p = path.join(ASSETS_DIR, taskArgs.file);
  const txFile = fs.readFileSync(p);
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
    console.log(addresses);
    const mparams = {
      version: decodedTx.msig.v,
      threshold: decodedTx.msig.thr,
      addrs: addresses
    };
    signedTxn = algosdk.appendSignMultisigTransaction(tx.blob, mparams, signer.sk);
    console.debug("Decoded txn after successfully signing: %O", algosdk.decodeSignedTransaction(signedTxn.blob));
  } else {
    console.log("Transaction is not a msig transaction.");
    return;
  }
  let outFile = taskArgs.file.slice(0, -4) + "_out.txn";
  if (taskArgs.out) {
    if (fs.pathExistsSync(taskArgs.out)) {
      console.log("Provided output path exists. Using default value for output.");
    } else {
      outFile = taskArgs.out;
    }
  }
  console.log(outFile);
  fs.outputFileSync(outFile, algosdk.encodeObj(signedTxn));
  console.log("Output file written succesfully.");
}

export default function (): void {
  task(TASK_SIGN_MULTISIG, "Signs a transaction object from a file using Multi Signature")
    .addParam(
      "account",
      "Name of the account to be used for signing the transaction."
    )
    .addParam(
      "file",
      "Name of the .txn file in assets directory"
    )
    .addFlag(
      "out",
      "Name of the file to be used for resultant transaction file. If not provided source transaction file's name will be appended by \"_out\""
    )
    .setAction((input, env) => multiSignTx(input, env));
}
