import { ERRORS } from "../../../src/internal/core/errors-list";
import { Op } from "../../../src/internal/interpreter/opcode";
import { MAX_UINT64, MIN_UINT64 } from "../../../src/lib/constants";
import { Stack } from "../../../src/lib/stack";
import { expectTealError } from "../../helpers/errors";

describe("Teal Opcodes basic assertions", function () {
  const op = new Op();

  it("check uint64 overflow", function () {
    const max = MAX_UINT64 + BigInt(5);
    expectTealError(
      () => op.checkOverFlow(max),
      ERRORS.TEAL.UINT64_OVERFLOW
    );
  });

  it("check uint64 underflow", function () {
    const min = MIN_UINT64 - 1;
    expectTealError(
      () => op.checkUnderFlow(BigInt(min)),
      ERRORS.TEAL.UINT64_UNDERFLOW
    );
  });

  it("check minimum stack length", function () {
    const stack = new Stack<string | bigint>();
    op.assertStackLen(stack, 0);

    stack.push("arg_0");
    expectTealError(
      () => op.assertStackLen(stack, 2),
      ERRORS.TEAL.ASSERT_STACK_LENGTH
    );
  });
});
