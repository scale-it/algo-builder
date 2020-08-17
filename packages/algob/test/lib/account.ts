import { generateAccount, secretKeyToMnemonic } from "algosdk";
import { assert } from "chai";

import { mkAccounts } from "../../src/lib/account";
import { Account, AccountDef } from "../../src/types";

describe("Loading accounts", () => {
  const _gen = generateAccount();
  const gen = { name: "gen_1", addr: _gen.addr, sk: _gen.sk };
  const skArray = Array.from({ length: 64 }, (_, i) => i + 1);
  const account1 = { name: "a1", addr: "a1", sk: new Uint8Array(skArray) };

  it("mkAccounts works when input is a list of Account objects", () => {
    let a = mkAccounts([]);
    assert.deepEqual(a, [], "should return empty list on empty input");

    const expected: Account[] = [account1,
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
});
