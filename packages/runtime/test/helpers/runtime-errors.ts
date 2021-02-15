import { assert, AssertionError } from "chai";

import { ErrorDescriptor } from "../../src/errors/errors-list";
import { RuntimeError } from "../../src/errors/runtime-errors";
import type { Operator, StackElem, TEALStack } from "../../src/types";

// takes string array and executes opcode to expect teal error
export function execExpectError (
  stack: TEALStack,
  strs: StackElem[],
  op: Operator,
  err: ErrorDescriptor): () => void {
  return () => {
    for (const s of strs) {
      stack.push(s);
    }
    expectRuntimeError(() => op.execute(stack), err);
  };
}

export function expectRuntimeError (
  f: () => any,
  errorDescriptor: ErrorDescriptor,
  matchMessage?: string | RegExp,
  errorMessage?: string
): void {
  try {
    f();
  } catch (error) {
    assert.instanceOf(error, RuntimeError, errorMessage);
    assert.equal(error.number, errorDescriptor.number, errorMessage);
    assert.notMatch(
      error.message,
      /%[a-zA-Z][a-zA-Z0-9]*%/,
      "RuntimeError has an non-replaced variable tag"
    );

    if (typeof matchMessage === "string") {
      assert.include(error.message, matchMessage, errorMessage);
    } else if (matchMessage !== undefined) {
      assert.match(error.message, matchMessage, errorMessage);
    }

    return;
  }
  throw new AssertionError( // eslint-disable-line @typescript-eslint/no-throw-literal
    `RuntimeError number ${errorDescriptor.number} expected, but no Error was thrown`
  );
}

export async function expectRuntimeErrorAsync (
  f: () => Promise<any>,
  errorDescriptor: ErrorDescriptor,
  matchMessage?: string | RegExp
): Promise<void> {
  // We create the error here to capture the stack trace before the await.
  // This makes things easier, at least as long as we don't have async stack
  // traces. This may change in the near-ish future.
  const error = new AssertionError(
    `RuntimeError number ${errorDescriptor.number} expected, but no Error was thrown`
  );

  const match = String(matchMessage);
  const notExactMatch = new AssertionError(
    `RuntimeError was correct, but should have include "${match}" but got "`
  );

  const notRegexpMatch = new AssertionError(
    `RuntimeError was correct, but should have matched regex ${match} but got "`
  );

  try {
    await f();
  } catch (error) {
    assert.instanceOf(error, RuntimeError);
    assert.equal(error.number, errorDescriptor.number);
    assert.notMatch(
      error.message,
      /%[a-zA-Z][a-zA-Z0-9]*%/,
      "RuntimeError has an non-replaced variable tag"
    );

    if (matchMessage !== undefined) {
      if (typeof matchMessage === "string") {
        if (!error.message.includes(matchMessage)) {
          notExactMatch.message += `${String(error.message)}`;
          throw notExactMatch; // eslint-disable-line @typescript-eslint/no-throw-literal
        }
      } else {
        if (matchMessage.exec(error.message) === null) {
          notRegexpMatch.message += `${String(error.message)}`;
          throw notRegexpMatch; // eslint-disable-line @typescript-eslint/no-throw-literal
        }
      }
    }

    return;
  }

  throw error; // eslint-disable-line @typescript-eslint/no-throw-literal
}
