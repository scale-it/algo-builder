import { Account as AccountSDK, Kmd, mnemonicToSecretKey } from "algosdk";
import * as fs from "fs";
import YAML from "yaml";

import CfgErrors, { ErrorPutter } from "../internal/core/config/config-errors";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import type { Account, AccountDef, Accounts, HDAccount, MnemonicAccount, StrMap } from "../types";

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
    throw new BuilderError(ERRORS.ACCOUNT.WRONG_MNEMONIC, { errmsg: e.message }, e.error);
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

export function mkAccountIndex (accountList: Account[]): Accounts {
  const out = new Map<string, Account>();
  for (const a of accountList) {
    out.set(a.name, a);
  }
  return out;
}

interface KmdConfig {
  host: string
  port: number
  token: string
  wallets: Array<{name: string, password: string}>
}

export async function loadKMDAccounts (cfg: KmdConfig): Promise<AccountSDK[]> {
  const c = new Kmd(cfg.token, cfg.host, cfg.port);
  const wallets = (await c.listWallets()).wallets;
  const walletIDs: StrMap = {};
  for (const w of wallets) walletIDs[w.name] = w.id;

  const accounts: AccountSDK[] = [];
  for (const w of cfg.wallets) {
    const id = walletIDs[w.name];
    if (id === undefined) {
      console.warn("wallet id=", id, "doesn't exist in KDM");
      continue;
    }
    const token = (await c.initWalletHandle(id, w.password)).wallet_handle_token;
    const address = await c.listKeys(token);
    for (const addr of address.addresses) {
      const accountKey = (await kmdclient.exportKey(wallethandle, password, addr));
      accounts.push({ addr: addr, sk: accountKey.private_key });
    }
  }

  return accounts;
}
