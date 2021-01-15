/* eslint sonarjs/no-identical-functions: 0 */
import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { GlobalFields, MAX_UINT8, MAX_UINT64, MIN_UINT8, MIN_UINT64, TxnFields } from "../lib/constants";
import type { TEALStack } from "../types";
import { BIGINT0, BIGINT1 } from "./opcode-list";

export class Op {
  assertMinStackLen (stack: TEALStack, minLen: number, line: number): void {
    if (stack.length() < minLen) {
      throw new TealError(ERRORS.TEAL.ASSERT_STACK_LENGTH, { line: line });
    }
  }

  checkOverflow (num: bigint, line: number): void {
    if (num > MAX_UINT64) {
      throw new TealError(ERRORS.TEAL.UINT64_OVERFLOW, { line: line });
    }
  }

  checkUnderflow (num: bigint, line: number): void {
    if (num < MIN_UINT64) {
      throw new TealError(ERRORS.TEAL.UINT64_UNDERFLOW, { line: line });
    }
  }

  checkIndexBound (idx: number, arr: any[], line: number): void {
    console.log("BAALAL-------------------");
    if (!(idx >= 0 && idx < arr.length)) {
      console.log("HSGDKGHSKDK-----: ", line);
      throw new TealError(ERRORS.TEAL.INDEX_OUT_OF_BOUND, { line: line });
    }
  }

  assertArrLength (arr: Uint8Array[] | BigInt[], line: number): void {
    if (!arr.length || arr.length > MAX_UINT8 + 1) {
      throw new TealError(ERRORS.TEAL.ASSERT_ARR_LENGTH, { line: line });
    }
  }

  assertBigInt (a: unknown, line: number): bigint {
    if (typeof a === "undefined" || typeof a !== "bigint") {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE, {
        expected: "uint64",
        actual: typeof a,
        line: line
      });
    }
    return a;
  }

  assertBytes (b: unknown, line: number): Uint8Array {
    if (typeof b === 'undefined' || !(b instanceof Uint8Array)) {
      throw new TealError(ERRORS.TEAL.INVALID_TYPE, {
        expected: "byte[]",
        actual: typeof b,
        line: line
      });
    }
    return b;
  }

  assertUint8 (a: bigint, line: number): bigint {
    if (a < MIN_UINT8 || a > MAX_UINT8) {
      throw new TealError(ERRORS.TEAL.INVALID_UINT8, { line: line });
    }
    return a;
  }

  subString (start: bigint, end: bigint, byteString: Uint8Array, line: number): Uint8Array {
    if (end < start) {
      throw new TealError(ERRORS.TEAL.SUBSTRING_END_BEFORE_START, { line: line });
    }
    if (start > byteString.length || end > byteString.length) {
      throw new TealError(ERRORS.TEAL.SUBSTRING_RANGE_BEYOND, { line: line });
    }

    return byteString.slice(Number(start), Number(end));
  }

  // assert if known transaction field is passed
  assertTxFieldDefined (str: string, line: number): void {
    if (TxnFields[str] === undefined) {
      throw new TealError(ERRORS.TEAL.UNKOWN_TRANSACTION_FIELD, { field: str, line: line });
    }
  }

  // assert if known global field is passed
  assertGlobalDefined (str: string, line: number): void {
    if (GlobalFields[str] === undefined) {
      throw new TealError(ERRORS.TEAL.UNKOWN_GLOBAL_FIELD, { field: str, line: line });
    }
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
