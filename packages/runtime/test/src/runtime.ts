import { ExecParams, SignType, TransactionType } from "@algorand-builder/algob/src/types";
import { assert } from "chai";

import { StoreAccount } from "../../src/account";
import { Runtime } from "../../src/runtime";
import { getProgram } from "../helpers/files";
import { useFixture } from "../helpers/integration";

const programName = "basic.teal";
const minBalance = 1e7;

describe("Logic Signature Transaction in Runtime", () => {
  useFixture("basic-teal");
  const john = new StoreAccount(minBalance);
  const bob = new StoreAccount(minBalance);
  const runtime = new Runtime([john, bob]);

  it("should execute the lsig and verify john(delegated signature)", async () => {
    const lsig = runtime.getLogicSig(getProgram(programName), []);
    const txnParam: ExecParams = {
      type: TransactionType.TransferAlgo,
      sign: SignType.LogicSignature,
      fromAccount: john.account,
      toAccountAddr: bob.account.addr,
      amountMicroAlgos: 1000,
      lsig: lsig,
      payFlags: { totalFee: 1000 }
    };

    lsig.sign(john.account.sk);
    await runtime.executeTx(txnParam, getProgram(programName), []);

    const bobAcc = runtime.getAccount(bob.address);
    assert.equal(bobAcc.balance(), minBalance + 1000);
  });
});
