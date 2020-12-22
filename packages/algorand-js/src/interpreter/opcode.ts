import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { MAX_UINT8, MAX_UINT64, MIN_UINT8, MIN_UINT64, TxnFields } from "../lib/constants";
import type { TEALStack } from "../types";
import { BIGINT0, BIGINT1 } from "./opcode-list";

export class Op {
  assertMinStackLen (stack: TEALStack, minLen: number): void {
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

  checkIndexBound (idx: number, arr: any[]): void {
    if (!(idx >= 0 && idx < arr.length)) {
      throw new TealError(ERRORS.TEAL.INDEX_OUT_OF_BOUND);
    }
  }

  assertArrLength (arr: Uint8Array[] | BigInt[]): void {
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

  // assert if known transaction field is passed
  assertDefined (str: string): void {
    if (TxnFields[str] === undefined) {
      throw new TealError(ERRORS.TEAL.UNKOWN_TRANSACTION_FIELD, { field: str });
    }
  }

  assertUint8 (a: bigint): bigint {
    if (a < MIN_UINT8 || a > MAX_UINT8) {
      throw new TealError(ERRORS.TEAL.INVALID_UINT8);
    }
    return a;
  }

  subString (start: bigint, end: bigint, byteString: Uint8Array): Uint8Array {
    if (end < start) {
      throw new TealError(ERRORS.TEAL.SUBSTRING_END_BEFORE_START);
    }
    if (start > byteString.length || end > byteString.length) {
      throw new TealError(ERRORS.TEAL.SUBSTRING_RANGE_BEYOND);
    }

    return byteString.slice(Number(start), Number(end));
  }

  pushBooleanCheck (stack: TEALStack, ok: boolean): TEALStack {
    if (ok) {
      stack.push(BIGINT1);
    } else {
      stack.push(BIGINT0);
    }
    return stack;
  }
}
