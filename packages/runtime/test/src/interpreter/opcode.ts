import { ERRORS } from "../../../src/errors/errors-list";
import { Op } from "../../../src/interpreter/opcode";
import { MAX_UINT64, MIN_UINT64 } from "../../../src/lib/constants";
import { stringToBytes } from "../../../src/lib/parsing";
import { Stack } from "../../../src/lib/stack";
import type { StackElem } from "../../../src/types";
import { expectTealError } from "../../helpers/errors";

describe("Teal Opcodes basic assertions", function () {
  const op = new Op();

  it("check uint64 overflow", function () {
    const max = MAX_UINT64 + BigInt("5");
    const lineNumber = 1;

    expectTealError(
      () => op.checkOverflow(max, lineNumber),
      ERRORS.TEAL.UINT64_OVERFLOW
    );
  });

  it("check uint64 underflow", function () {
    const min = MIN_UINT64 - BigInt("1");
    const lineNumber = 1;

    expectTealError(
      () => op.checkUnderflow(min, lineNumber),
      ERRORS.TEAL.UINT64_UNDERFLOW
    );
  });

  it("check minimum stack length", function () {
    const stack = new Stack<StackElem>();
    let stackLen = 0;
    let lineNumber = 1;
    op.assertMinStackLen(stack, stackLen, lineNumber);

    stack.push(stringToBytes("arg_0"));
    stackLen = 2;
    lineNumber = 1;
    expectTealError(
      () => op.assertMinStackLen(stack, stackLen, lineNumber),
      ERRORS.TEAL.ASSERT_STACK_LENGTH
    );
  });
});
