import { types as rtypes } from "@algo-builder/runtime";
import { generateAccount, mnemonicToSecretKey, secretKeyToMnemonic } from "algosdk";
import { assert } from "chai";

import { loadAccountsFromEnv, mkAccounts } from "../../src/lib/account";
import { AccountDef } from "../../src/types";

describe("Loading accounts", () => {
  const genAccount = generateAccount();
  const gen = { name: "gen_1", addr: genAccount.addr, sk: genAccount.sk };
  const skArray = Array.from({ length: 64 }, (_, i) => i + 1);
  const account1 = { name: "a1", addr: "a1", sk: new Uint8Array(skArray) };

  it("mkAccounts works when input is a list of Account objects", () => {
    let a = mkAccounts([]);
    assert.deepEqual(a, [], "should return empty list on empty input");

    const expected: rtypes.Account[] = [account1,
      { name: "n2", addr: "a2", sk: new Uint8Array(skArray) }];
    a = mkAccounts(expected);
    assert.deepEqual(a, expected, "Account instances should be just copied");
  });

  it("mkAccounts handles mnemonic accounts and handles address check", () => {
    // we don't check empty addreses
    const expected = [gen];
    let input = [{ name: "gen_1", addr: "", mnemonic: secretKeyToMnemonic(gen.sk) }];
    assert.deepEqual(mkAccounts(input), expected, "Account instances should be just copied");

    // address matches -> ok
    input[0].addr = gen.addr;
    assert.deepEqual(mkAccounts(input), expected, "Account instances should be just copied");

    // address doesn't matches -> exception
    input[0].addr = "some other address";
    assert.throws(() => mkAccounts(input), "ABLDR400: Please use same address as the one specified in the mnemonic account");

    // fails on bad mnemonic
    input = [{ name: "n1", addr: "", mnemonic: "bad mnemonic" }];
    assert.throws(() => mkAccounts(input), "ABLDR401: the mnemonic contains a word that is not in the wordlist");

    // fails on missing name
    const goodMnemonic = "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide";
    input = [{ addr: "", mnemonic: goodMnemonic } as any];
    assert.throws(() => mkAccounts(input), 'ABLDR403: Invalid value "can\'t be empty" for .account_inputs.1.name - Expected a value of type string.');
  });

  it("Handles mixture of accounts", () => {
    // fails on HD account
    let input: AccountDef[] = [{ path: "0/1", mnemonic: "" }];
    const errmsg = "ABLDR402: HD accounts is not yet supported";
    assert.throws(() => mkAccounts(input), errmsg);

    // fails when HD account is between valid accounts
    input = [account1, input[0]];
    assert.throws(() => mkAccounts(input), errmsg);

    // good accounts are OK
    input = [account1, { name: "gen_1", addr: "", mnemonic: secretKeyToMnemonic(gen.sk) }];
    assert.deepEqual(mkAccounts(input), [account1, gen]);
  });

  it("From ENV variable (ALGOB_ACCOUNTS) ", () => {
    const goodMnemonic = "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide";
    process.env.ALGOB_ACCOUNTS = JSON.stringify([{ name: "master", mnemonic: goodMnemonic }]);
    const accountSDK = mnemonicToSecretKey(goodMnemonic);
    const accounts = [{ name: "master", addr: accountSDK.addr, sk: accountSDK.sk }];
    var algobAccounts = loadAccountsFromEnv();
    assert.deepEqual(algobAccounts, accounts, "Loaded accounts mismatch");

    delete process.env.ALGOB_ACCOUNTS;
    algobAccounts = loadAccountsFromEnv();
    assert.deepEqual(algobAccounts, [], "Loaded accounts mismatch");
  });

  it("ENV variables validate ALGOB_ACCOUNTS ", () => {
    const goodMnemonic = "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide";
    const emptyMnemonic = "";
    const badMnemonic = "arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide";

    // fails when account name is empty
    process.env.ALGOB_ACCOUNTS = JSON.stringify([{ name: "", mnemonic: goodMnemonic }]);
    var errmsg = 'ABLDR404: Field account name must be defined and not empty in ' + JSON.stringify({ name: "", mnemonic: goodMnemonic });
    assert.throws(() => loadAccountsFromEnv(), errmsg);

    // fails when account name is missing
    process.env.ALGOB_ACCOUNTS = JSON.stringify([{ mnemonic: goodMnemonic }]);
    errmsg = 'ABLDR404: Field account name must be defined and not empty in ' + JSON.stringify({ mnemonic: goodMnemonic });
    assert.throws(() => loadAccountsFromEnv(), errmsg);

    // fails when mnemonic string is empty
    process.env.ALGOB_ACCOUNTS = JSON.stringify([{ name: "master", mnemonic: emptyMnemonic }, { name: "master", mnemonic: goodMnemonic }]);
    errmsg = 'ABLDR404: Field mnemonic string must be defined and not empty in ' + JSON.stringify({ name: "master", mnemonic: emptyMnemonic });
    assert.throws(() => loadAccountsFromEnv(), errmsg);

    // fails when mnemonic string is missing
    process.env.ALGOB_ACCOUNTS = JSON.stringify([{ name: "master" }]);
    errmsg = 'ABLDR404: Field mnemonic string must be defined and not empty in ' + JSON.stringify({ name: "master" });
    assert.throws(() => loadAccountsFromEnv(), errmsg);

    // fails mnemonic string is bad
    process.env.ALGOB_ACCOUNTS = JSON.stringify([{ name: "master", mnemonic: badMnemonic }]);
    errmsg = 'ABLDR401: failed to decode mnemonic in ' + JSON.stringify({ name: "master", mnemonic: badMnemonic });
    assert.throws(() => loadAccountsFromEnv(), errmsg);
  });
});
