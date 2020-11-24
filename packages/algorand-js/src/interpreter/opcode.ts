import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { MAX_UINT8, MAX_UINT64, MIN_UINT64 } from "../lib/constants";
import type { TEALStack } from "../types";

export class Op {
  assertStackLen (stack: TEALStack, minLen: number): void {
    if (stack.length() < minLen) {
      throw new TealError(ERRORS.TEAL.ASSERT_STACK_LENGTH);
    }
  }

  checkOverflow (num: bigint): void {
    if (num > MAX_UINT64) {
      throw new TealError(ERRORS.TEAL.UINT64_OVERFLOW);
    }
  }

  checkUnderflow (num: bigint): void {
    if (num < MIN_UINT64) {
      throw new TealError(ERRORS.TEAL.UINT64_UNDERFLOW);
    }
  }

  checkIndexBound (idx: number, arr: Array<Uint8Array | bigint>): void {
    if (!(idx >= 0 && idx < arr.length)) {
      throw new TealError(ERRORS.TEAL.INDEX_OUT_OF_BOUND);
    }
  }

  assertArrLength (arr: Uint8Array[] | Array<bigint>): void {
    if (!arr.length || arr.length > MAX_UINT8 + 1) {
      throw new TealError(ERRORS.TEAL.ASSERT_ARR_LENGTH);
    }
  }

  assertBigInt (a: unknown): bigint {
    if (typeof a === "undefined" || typeof a !== "bigint") {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE, {
        expected: "uint64",
        actual: typeof a
      });
    }
    return a;
  }

  assertBytes (b: unknown): Uint8Array {
    if (typeof b === 'undefined' || !(b instanceof Uint8Array)) {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE, {
        expected: "byte[]",
        actual: typeof b
      });
    }
    return b;
  }
}
