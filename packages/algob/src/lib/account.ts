import { Account as AccountSDK, Kmd, mnemonicToSecretKey, MultiSigAccount, multisigAddress } from "algosdk";
import * as fs from "fs";
import YAML from "yaml";

import CfgErrors, { ErrorPutter } from "../internal/core/config/config-errors";
import { BuilderError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import type { Account, AccountDef, Accounts, AlgobAccount, HDAccount, KmdCfg, KmdWallet, MnemonicAccount, StrMap } from "../types";

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

export function loadAccountsFromEnv (): Account[] {
  var algobAccountsString = process.env.ALGOB_ACCOUNTS;
  if (algobAccountsString) {
    var accounts: AlgobAccount[] = [];
    try {
      accounts = JSON.parse(algobAccountsString);
    } catch (error) {
      throw new BuilderError(ERRORS.ACCOUNT.MALFORMED, { errors: 'Some accounts are malformed or have missing fields' });
    }
    validateAlgobAccounts(accounts);
    var algobAccounts: Account[] = [];
    for (const account of accounts) {
      try {
        const accountSDK = mnemonicToSecretKey(account.mnemonic);
        algobAccounts.push({ name: account.name, addr: accountSDK.addr, sk: accountSDK.sk });
      } catch (error) {
        throw new BuilderError(ERRORS.ACCOUNT.WRONG_MNEMONIC,
          { errmsg: 'failed to decode mnemonic in ' + JSON.stringify(account) });
      }
    }
    return algobAccounts;
  }
  return [];
}

// returns multisignature account address
export function createMsigAddress (
  version: number,
  threshold: number,
  accountList: string[]): [MultiSigAccount, string] {
  const mparams = {
    version: version,
    threshold: threshold,
    addrs: accountList
  };
  return [mparams, multisigAddress(mparams)];
}

function validateAlgobAccounts (algobAccounts: AlgobAccount[]): void {
  for (const account of algobAccounts) {
    if (account.name === undefined) {
      throw new BuilderError(ERRORS.ACCOUNT.FIELD_REQUIRED,
        { errors: 'Field account name must be defined and not empty in ' + JSON.stringify(account) });
    }
    if (account.mnemonic === undefined) {
      throw new BuilderError(ERRORS.ACCOUNT.FIELD_REQUIRED,
        { errors: 'Field mnemonic string must be defined and not empty in ' + JSON.stringify(account) });
    }
    if (account.name === "") {
      throw new BuilderError(ERRORS.ACCOUNT.FIELD_REQUIRED,
        { errors: 'Field account name must be defined and not empty in ' + JSON.stringify(account) });
    }
    if (account.mnemonic === "") {
      throw new BuilderError(ERRORS.ACCOUNT.FIELD_REQUIRED,
        { errors: 'Field mnemonic string must be defined and not empty in ' + JSON.stringify(account) });
    }
  }
}

export class KMDOperator {
  kmdcl: Kmd;

  constructor (kmdcl: Kmd) {
    this.kmdcl = kmdcl;
  }

  kmdWalletAddrNames (kwallet: KmdWallet): StrMap {
    const m: StrMap = {};
    for (const a of kwallet.accounts) {
      m[a.address] = a.name;
    }
    return m;
  }

  async loadKMDAccounts (kcfg: KmdCfg): Promise<Account[]> {
    const accounts: Account[] = [];
    try {
      const wallets = (await this.kmdcl.listWallets()).wallets;

      const walletIDs: StrMap = {};
      for (const w of wallets) walletIDs[w.name] = w.id;

      for (const w of kcfg.wallets) {
        const id = walletIDs[w.name];
        if (id === undefined) {
          console.warn("wallet id=", id, "defined in config but it doesn't exist in KMD");
          continue;
        }
        const names = this.kmdWalletAddrNames(w);
        const token = (await this.kmdcl.initWalletHandle(id, w.password)).wallet_handle_token;
        const keys = await this.kmdcl.listKeys(token);
        for (const addr of keys.addresses) {
          const n = names[addr];
          if (n === undefined) {
            console.debug("KMD account with address:", addr, " not found in wallet:1", w.name);
            continue;
          }
          // console.debug("Adding KMD account name:", n)
          const k = await this.kmdcl.exportKey(token, w.password, addr);
          accounts.push({ name: n, addr: addr, sk: new Uint8Array(k.private_key) });
        }
      }
    } catch (e) {
      if (e.code === 'ECONNREFUSED') { throw new BuilderError(ERRORS.KMD.CONNECTION, { ctx: e }, e); }
      throw new BuilderError(ERRORS.KMD.ERROR, { ctx: JSON.stringify(e) }, e);
    }

    return accounts;
  }
}
