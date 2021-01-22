import { assert } from "chai";

import { StoreAccount } from "../../src/account";
import { Runtime } from "../../src/runtime";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

const programName = "escrow.teal";

describe("Logic Signature Test", () => {
  // console.log(fromMultisigPreImg({version: 1, threshold: 2, pks: []}));
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

  it("should verify only for lsig address", () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);

    let result = lsig.verify(lsig.address());
    assert.equal(result, true);

    result = lsig.verify(john.address);
    assert.equal(result, false);
  });
});
