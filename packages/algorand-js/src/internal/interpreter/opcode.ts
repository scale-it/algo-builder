import { MAX_UINT64, MIN_UINT64 } from "../../lib/constants";
import { IStack } from "../../lib/stack";
import { TealError } from "../core/errors";
import { ERRORS } from "../core/errors-list";

export class Op {
  assertStackLen (stack: IStack<string | bigint>, minLen: number): void {
    if (stack.length() < minLen) {
      throw new TealError(ERRORS.TEAL.ASSERT_STACK_LENGTH);
    }
  }

  checkOverFlow (num: bigint): void {
    if (num > MAX_UINT64) {
      throw new TealError(ERRORS.TEAL.UINT64_OVERFLOW);
    }
  }

  checkUnderFlow (num: bigint): void {
    if (num < MIN_UINT64) {
      throw new TealError(ERRORS.TEAL.UINT64_UNDERFLOW);
    }
  }
}
