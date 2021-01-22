import { createMsigAddress } from "@algorand-builder/algob";
import { assert } from "chai";

import { StoreAccount } from "../../src/account";
import { Runtime } from "../../src/runtime";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

const programName = "escrow.teal";
const multiSigProg = "sample-asc.teal";

describe("Logic Signature Test", () => {
  useFixture("escrow-account");
  const john = new StoreAccount(10);
  const bob = new StoreAccount(100);
  const runtime = new Runtime([john, bob]);

  it("should sign the lsig by john(delegated signature)", () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);

    lsig.sign(john.account);
    const result = lsig.verify(john.address);

    assert.equal(result, true);
  });

  it("should return false if lsig is not signed by john(delegated signature)", () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);

    lsig.sign(bob.account);
    const result = lsig.verify(john.address);

    assert.equal(result, false);
  });

  it("should verify only for lsig address(escrow account)", () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);

    let result = lsig.verify(lsig.address());
    assert.equal(result, true);

    result = lsig.verify(john.address);
    assert.equal(result, false);
  });
});

describe("Multi-Signature Test", () => {
  useFixture("multi-signature");
  const alice = new StoreAccount(10);
  const john = new StoreAccount(100);
  const bob = new StoreAccount(1000);

  const runtime = new Runtime([alice, john, bob]);
  // Generate multi signature account hash
  const addrs = [alice.address, john.address, bob.address];
  const [mparams, multsigaddr] = createMsigAddress(1, 2, addrs); // passing (version, threshold, address list)

  it("should verify if threshold is verified and sender is multisigAddr", () => {
    const lsig = runtime.getLogicSig(getProgram(multiSigProg), []);
    // lsig signed by alice
    lsig.sign(alice.account, mparams);
    // lsig signed again (threshold = 2) by john
    lsig.appendToMultisig(john.account);

    const result = lsig.verify(multsigaddr);
    assert.equal(result, true);
  });

  it("should not verify if threshold is achieved but sender is not multisigAddr", () => {
    const lsig = runtime.getLogicSig(getProgram(multiSigProg), []);
    // lsig signed by alice
    lsig.sign(alice.account, mparams);
    // lsig signed again (threshold = 2) by john
    lsig.appendToMultisig(john.account);

    const result = lsig.verify(bob.address);
    assert.equal(result, false);
  });

  it("should not verify if threshold is not achieved but sender is multisigAddr", () => {
    const lsig = runtime.getLogicSig(getProgram(multiSigProg), []);
    // lsig signed by alice
    lsig.sign(alice.account, mparams);

    const result = lsig.verify(multsigaddr);
    assert.equal(result, false);
  });
});
