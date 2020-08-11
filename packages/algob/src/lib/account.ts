import { Account, mnemonicToSecretKey } from "algosdk";
import * as fs from "fs";
import YAML from "yaml";

import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import type { AccountDef, HDAccount, MnemonicAccount } from "../types";

export function mkAccounts (input: AccountDef[]): Account[] {
  const accounts: Account[] = [];
  for (const i of input) {
    if ((i as HDAccount).path) {
      throw new BuilderError(ERRORS.ACCOUNT.HD_ACCOUNT, { path: (i as HDAccount).path });
    } else if ((i as Account).sk) {
      accounts.push(i as Account);
    } else {
      accounts.push(fromMnemonic(i as MnemonicAccount));
    }
  }
  return accounts;
}

function fromMnemonic (ia: MnemonicAccount): Account {
  const a = parseMnemonic(ia.mnemonic);
  if (a.addr !== ia.addr && ia.addr !== "") {
    throw new BuilderError(ERRORS.ACCOUNT.MNEMONIC_ADDR_MISSMATCH,
      { addr: ia.addr, mnemonic: ia.mnemonic });
  }
  return { addr: a.addr, sk: a.sk };
}

function parseMnemonic (mnemonic: string): Account {
  try {
    return mnemonicToSecretKey(mnemonic);
  } catch (e) {
    throw new BuilderError(ERRORS.ACCOUNT.WRONG_MNEMONIC, { errmsg: e.message });
  }
}

function _loadAccounts (content: string): Account[] {
  const parsed = YAML.parse(content) as AccountDef[];
  return mkAccounts(parsed);
}

// Loads accounts from `filename`. The file should be a YAML file with list of objects
// which is either `HDAccount`, `MnemonicAccount` or an `Account`.
export async function loadAccountsFromFile (filename: string): Promise<Account[]> {
  return _loadAccounts(await fs.promises.readFile(filename, 'utf8'));
}

// Same as `loadAccountsFromFile` but uses sync method instead of async
export function loadAccountsFromFileSync (filename: string): Account[] {
  return _loadAccounts(fs.readFileSync(filename, 'utf8'));
}
