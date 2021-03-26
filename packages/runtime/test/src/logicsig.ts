import { decodeAddress, multisigAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore } from "../../src/account";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { Runtime } from "../../src/runtime";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";

const programName = "escrow.teal";
const multiSigProg = "sample-asc.teal";

describe("Logic Signature", () => {
  useFixture("escrow-account");
  const john = new AccountStore(10);
  const bob = new AccountStore(100);
  const runtime = new Runtime([john, bob]);
  const johnPk = decodeAddress(john.address).publicKey;

  it("john should be able to create a delegated signature", () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);

    lsig.sign(john.account.sk);
    assert.isTrue(lsig.verify(johnPk));
  });

  it("should fail to verify delegated signature signed by someone else", () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);

    lsig.sign(bob.account.sk);
    const result = lsig.verify(johnPk);

    assert.equal(result, false);
  });

  it("should handle contract lsig (escrow account) verification correctly", () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);

    let result = lsig.verify(decodeAddress(lsig.address()).publicKey);
    assert.equal(result, true);

    result = lsig.verify(johnPk);
    assert.equal(result, false);
  });

  it("should fail if empty program is passed", () => {
    expectRuntimeError(
      () => runtime.getLogicSig("", []),
      RUNTIME_ERRORS.GENERAL.INVALID_PROGRAM
    );
  });
});

describe("Multi-Signature Test", () => {
  useFixture("multi-signature");
  const alice = new AccountStore(10);
  const john = new AccountStore(100);
  const bob = new AccountStore(1000);
  const bobPk = decodeAddress(bob.address).publicKey;

  const runtime = new Runtime([alice, john, bob]);
  // Generate multi signature account hash
  const addrs = [alice.address, john.address, bob.address];
  const mparams = {
    version: 1,
    threshold: 2,
    addrs: addrs
  };
  const multsigaddr = multisigAddress(mparams);

  it("should verify if threshold is verified and sender is multisigAddr", () => {
    const lsig = runtime.getLogicSig(getProgram(multiSigProg), []);
    // lsig signed by alice
    lsig.sign(alice.account.sk, mparams);
    // lsig signed again (threshold = 2) by john
    lsig.appendToMultisig(john.account.sk);

    const result = lsig.verify(decodeAddress(multsigaddr).publicKey);
    assert.equal(result, true);
  });

  it("should not verify if threshold is achieved but sender is not multisigAddr", () => {
    const lsig = runtime.getLogicSig(getProgram(multiSigProg), []);
    // lsig signed by alice
    lsig.sign(alice.account.sk, mparams);
    // lsig signed again (threshold = 2) by john
    lsig.appendToMultisig(john.account.sk);

    const result = lsig.verify(bobPk);
    assert.equal(result, false);
  });

  it("should not verify if threshold is not achieved but sender is multisigAddr", () => {
    const lsig = runtime.getLogicSig(getProgram(multiSigProg), []);
    // lsig signed by alice
    lsig.sign(alice.account.sk, mparams);

    const result = lsig.verify(decodeAddress(multsigaddr).publicKey);
    assert.equal(result, false);
  });
});
