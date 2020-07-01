import { assert, AssertionError, expect } from "chai";

import { BuilderError } from "../../src/internal/core/errors";
import { ErrorDescriptor } from "../../src/internal/core/errors-list";

export async function expectErrorAsync(
  f: () => Promise<any>,
  matchMessage?: string | RegExp
) {
  const noError = new AssertionError("Async error expected but not thrown");
  const notExactMatch = new AssertionError(
    `Async error should have had message "${matchMessage}" but got "`
  );

  const notRegexpMatch = new AssertionError(
    `Async error should have matched regex ${matchMessage} but got "`
  );

  try {
    await f();
  } catch (err) {
    if (matchMessage === undefined) {
      return;
    }

    if (typeof matchMessage === "string") {
      if (err.message !== matchMessage) {
        notExactMatch.message += `${err.message}"`;
        throw notExactMatch;
      }
    } else {
      if (matchMessage.exec(err.message) === null) {
        notRegexpMatch.message += `${err.message}"`;
        throw notRegexpMatch;
      }
    }

    return;
  }

  throw noError;
}

export function expectBuilderError(
  f: () => any,
  errorDescriptor: ErrorDescriptor,
  matchMessage?: string | RegExp,
  errorMessage?: string
) {
  try {
    f();
  } catch (error) {
    assert.instanceOf(error, BuilderError, errorMessage);
    assert.equal(error.number, errorDescriptor.number, errorMessage);
    assert.notMatch(
      error.message,
      /%[a-zA-Z][a-zA-Z0-9]*%/,
      "BuilderError has an non-replaced variable tag"
    );

    if (typeof matchMessage === "string") {
      assert.include(error.message, matchMessage, errorMessage);
    } else if (matchMessage !== undefined) {
      assert.match(error.message, matchMessage, errorMessage);
    }

    return;
  }

  throw new AssertionError(
    `BuilderError number ${errorDescriptor.number} expected, but no Error was thrown`
  );
}

export async function expectBuilderErrorAsync(
  f: () => Promise<any>,
  errorDescriptor: ErrorDescriptor,
  matchMessage?: string | RegExp
) {
  // We create the error here to capture the stack trace before the await.
  // This makes things easier, at least as long as we don't have async stack
  // traces. This may change in the near-ish future.
  const error = new AssertionError(
    `BuilderError number ${errorDescriptor.number} expected, but no Error was thrown`
  );

  const notExactMatch = new AssertionError(
    `BuilderError was correct, but should have include "${matchMessage}" but got "`
  );

  const notRegexpMatch = new AssertionError(
    `BuilderError was correct, but should have matched regex ${matchMessage} but got "`
  );

  try {
    await f();
  } catch (error) {
    assert.instanceOf(error, BuilderError);
    assert.equal(error.number, errorDescriptor.number);
    assert.notMatch(
      error.message,
      /%[a-zA-Z][a-zA-Z0-9]*%/,
      "BuilderError has an non-replaced variable tag"
    );

    if (matchMessage !== undefined) {
      if (typeof matchMessage === "string") {
        if (!error.message.includes(matchMessage)) {
          notExactMatch.message += `${error.message}`;
          throw notExactMatch;
        }
      } else {
        if (matchMessage.exec(error.message) === null) {
          notRegexpMatch.message += `${error.message}`;
          throw notRegexpMatch;
        }
      }
    }

    return;
  }

  throw error;
}
