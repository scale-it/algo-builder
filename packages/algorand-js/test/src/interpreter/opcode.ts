import { ERRORS } from "../../../src/errors/errors-list";
import { Op } from "../../../src/interpreter/opcode";
import { MAX_UINT64, MIN_UINT64 } from "../../../src/lib/constants";
import { toBytes } from "../../../src/lib/parsing";
import { Stack } from "../../../src/lib/stack";
import type { StackElem } from "../../../src/types";
import { expectTealError } from "../../helpers/errors";

describe("Teal Opcodes basic assertions", function () {
  const op = new Op();

  it("check uint64 overflow", function () {
    const max = MAX_UINT64 + BigInt("5");
    expectTealError(
      () => op.checkOverflow(max),
      ERRORS.TEAL.UINT64_OVERFLOW
    );
  });

  it("check uint64 underflow", function () {
    const min = MIN_UINT64 - BigInt("1");
    expectTealError(
      () => op.checkUnderflow(min),
      ERRORS.TEAL.UINT64_UNDERFLOW
    );
  });

  it("check minimum stack length", function () {
    const stack = new Stack<StackElem>();
    op.assertMinStackLen(stack, 0);

    stack.push(toBytes("arg_0"));
    expectTealError(
      () => op.assertMinStackLen(stack, 2),
      ERRORS.TEAL.ASSERT_STACK_LENGTH
    );
  });
});
