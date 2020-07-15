import algosdk from "algosdk";
import * as _fs from "fs";
import * as path from "path";
import YAML from "yaml";

import { task } from "../internal/core/config/config-env";
import { BuilderError, ERRORS } from "../internal/core/errors";
import * as types from "../internal/core/params/argument-types";
import { assertAllDirs, ASSETS_DIR } from "../internal/core/project-structure";
import { AlgobRuntimeEnv, TaskArguments } from "../types";
import { TASK_GEN_ACCOUNTS } from "./task-names";
const fsp = _fs.promises;

export default function (): void {
  task(TASK_GEN_ACCOUNTS, "Generates custom accounts (not safe for production use)")
    .addPositionalParam("n", "number of accounts to generate", undefined, types.int, false)
    .addFlag("force", "overwride generated accounts if the file already exists")
    .setAction(mkAccounts);
}

export function getFilename (): string { return path.join(ASSETS_DIR, "accounts_generated.yaml"); }

export async function mkAccounts (taskArgs: TaskArguments, env: AlgobRuntimeEnv): Promise<void> {
  const filename = getFilename();
  const n = taskArgs.n as number;
  if (n <= 0) {
    throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
      value: n,
      name: 'n'
    });
  }
  console.info("GENERATING", n, "ACCOUNTS to ", filename);
  const accounts = genAccounts(n);
  return await writeToFile(YAML.stringify(accounts), taskArgs.force as boolean, filename);
}

export function genAccounts (n: number): Acc[] {
  const accounts: Acc[] = [];
  for (let i = 0; i < n; ++i) {
    const a = algosdk.generateAccount();
    accounts.push({
      addr: a.addr,
      mnemonic: algosdk.secretKeyToMnemonic(a.sk)
    });
  }
  return accounts;
}

export interface Acc {
  addr: string
  mnemonic: string
}

async function writeToFile (content: string, force: boolean, filename: string): Promise<void> {
  await assertAllDirs();
  try {
    await fsp.access(filename, _fs.constants.F_OK);
    if (!force) {
      console.error("File", filename,
        "already exists. Aborting. Use --force flag if you want to overwrite it");
      return;
    }
  } catch (e) {}

  try {
    await fsp.writeFile(filename, content, 'utf8');
  } catch (e) {
    const err = e as Error;
    console.log("An error occured while writing to file:", filename);
    console.error(err.name, err.message);
  }
}
