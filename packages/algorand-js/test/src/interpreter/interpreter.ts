import { assert } from "chai";

import { ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import { Add, Arg_0, Arg_1 } from "../../../src/interpreter/opcode-list";
import { expectTealError } from "../../helpers/errors";

const fkParam = {
  type: 0,
  sign: 0,
  fromAccount: { addr: '', sk: new Uint8Array(0) },
  to: '',
  appId: 0,
  payFlags: {}
};

describe("Interpreter", function () {
  const interpreter = new Interpreter();
  interpreter.execute(fkParam, [], []);

  it("should throw error if top of stack is invalid", function () {
    const interpreter = new Interpreter();
    const args = [""];
    const logic = [new Arg_0(args)];
    expectTealError(
      () => interpreter.execute(fkParam, logic, args),
      ERRORS.TEAL.TEAL_REJECTION_ERROR
    );
  });

  it("should return true if top of stack > 0 according to logic", function () {
    const interpreter = new Interpreter();
    const args = [1, 2];
    const logic = [
      new Arg_0(args),
      new Arg_1(args),
      new Add()
    ];
    const res = interpreter.execute(fkParam, logic, args);
    assert.isTrue(res);
  });
});
