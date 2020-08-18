import { Account as AccountSDK, mnemonicToSecretKey } from "algosdk";
import * as fs from "fs";
import YAML from "yaml";

import CfgErrors, { ErrorPutter } from "../internal/core/config/config-errors";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import type { Account, AccountDef, HDAccount, MnemonicAccount } from "../types";

export function mkAccounts (input: AccountDef[]): Account[] {
  const accounts: Account[] = [];
  const errs = new CfgErrors("");
  let a: Account;
  let idx = 0;
  for (const i of input) {
    ++idx;
    if ((i as HDAccount).path) {
      throw new BuilderError(ERRORS.ACCOUNT.HD_ACCOUNT, { path: (i as HDAccount).path });
    } else if ((i as Account).sk) { a = i as Account; } else { a = fromMnemonic(i as MnemonicAccount); }
    if (validateAccount(a, errs.putter("account_inputs", idx.toString()))) { accounts.push(a); }
  }
  if (!errs.isEmpty()) { throw new BuilderError(ERRORS.ACCOUNT.MALFORMED, { errors: errs.toString() }); }
  return accounts;
}

function fromMnemonic (ia: MnemonicAccount): Account {
  const a = parseMnemonic(ia.mnemonic);
  if (a.addr !== ia.addr && ia.addr !== "") {
    throw new BuilderError(ERRORS.ACCOUNT.MNEMONIC_ADDR_MISSMATCH,
      { name: ia.name, addr: ia.addr, mnemonic: ia.mnemonic });
  }
  return { name: ia.name, addr: a.addr, sk: a.sk };
}

function parseMnemonic (mnemonic: string): AccountSDK {
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

// returns false if account validation doesn't pass
export function validateAccount (a: Account, errs: ErrorPutter): boolean {
  if (a.addr === "") { errs.push("addr", "can't be empty", "string"); }
  if (!(a.sk && a.sk instanceof Uint8Array && a.sk.length === 64)) { errs.push("sk", "Must be an instance of Uint8Array(64)", 'Uint8Array'); }
  if (!(typeof a.name === 'string' && a.name !== "")) { errs.push("name", "can't be empty", 'string'); }
  return errs.isEmpty;
}
