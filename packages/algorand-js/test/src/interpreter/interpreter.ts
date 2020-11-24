import { ERRORS } from "../../../src/errors/errors-list";
import { Interpreter } from "../../../src/interpreter/interpreter";
import { Arg } from "../../../src/interpreter/opcode-list";
import { toBytes } from "../../../src/lib/parse-data";
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
  it("should throw error if top of stack is invalid", function () {
    const interpreter = new Interpreter();
    const args = [toBytes("")];
    const logic = [new Arg(args[0])];
    expectTealError(
      () => interpreter.execute(fkParam, logic, args),
      ERRORS.TEAL.LOGIC_REJECTION
    );
  });
});
