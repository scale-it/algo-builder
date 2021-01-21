import { assert } from "chai";

import { StoreAccount } from "../../src/account";
import { Runtime } from "../../src/runtime";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

describe("Logic Signature Test", () => {
  useFixture("escrow-account");
  const john = new StoreAccount(10);
  const bob = new StoreAccount(100);
  const runtime = new Runtime([john, bob]);

  it("should sign the lsig by john", () => {
    const lsig = runtime.getLogicSig(getProgram("escrow.teal"), []);

    lsig.sign(john.account);
    const result = lsig.verify(john.address);

    assert.equal(result, true);
  });

  it("should return false if lsig is not signed by john", () => {
    const lsig = runtime.getLogicSig(getProgram("escrow.teal"), []);

    lsig.sign(bob.account);
    const result = lsig.verify(john.address);

    assert.equal(result, false);
  });
});
