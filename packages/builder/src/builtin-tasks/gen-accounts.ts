import * as _fs from "fs";
const fsp = _fs.promises;
import YAML from "yaml";
import * as path from "path";

import { task } from "../internal/core/config/config-env";
import * as types from "../internal/core/params/argument-types";
import { assertAllDirs,ASSETS_DIR } from "../internal/core/project-structure"
import { AlgobRuntimeEnv, TaskArguments } from "../types";
import { TASK_GEN_ACCOUNTS } from "./task-names";

const algosdk = require("algosdk");  // eslint-disable-line @typescript-eslint/no-var-requires

export default function (): void {
  task(TASK_GEN_ACCOUNTS, "Generates custom accounts (not safe for production use)")
    .addPositionalParam("n", "number of accounts to generate", undefined, types.int, false)
    .addFlag("force", "overwride generated accounts if the file already exists")
    .setAction(genAccounts);
}

const filename = path.join(ASSETS_DIR, "accounts_generated.yaml");

async function genAccounts(taskArgs: TaskArguments, env: AlgobRuntimeEnv) {
  const n = taskArgs.n as number;
  console.debug("GENERATING", n, "ACCOUNTS to ", filename);

  const accounts: Acc[] = [];
  for (let i=0; i<n; ++i){
    const a = algosdk.generateAccount();
    accounts.push({
      addr: a.addr,
      mnemonic: algosdk.secretKeyToMnemonic(a.sk)});
  }
  return writeToFile(YAML.stringify(accounts), taskArgs.force as boolean);
}

interface Acc {
  addr: string;
  mnemonic: string;
}

async function writeToFile(content: string, force: boolean) {
  await assertAllDirs();
  try {
    await fsp.access(filename, _fs.constants.F_OK);
    if(!force){
      console.error("File", filename, "already exists. Aborging. Use --force flag if you want to overwrite it");
      return
    }
  } catch(e){}

  try {
    await fsp.writeFile(filename, content, 'utf8');
  } catch (e) {
    const err = e as Error;
    console.log("An error occured while writing to file:", filename);
    console.error(err.name, err.message);
  }
}
