import { assert } from "chai";

import { ERRORS } from "../../src/internal/core/errors-list";
import { assertDirChildren, assertDirectDirChildren } from "../../src/lib/files";
import { expectBuilderError } from "../helpers/errors";

describe("assertDirChildren", () => {
  it("Should pass for children inputs", async () => {
    const out = assertDirChildren("a", ["a/a/a/b", "a/b", "a/b/c", "./a/e"]);
    assert.deepEqual(out, ["a/a/a/b", "a/b", "a/b/c", "a/e"]);
  });

  it("Should normalize paths", async () => {
    const out = assertDirChildren("a", ["a/q/q/../../a/a/b", "a/q/q/../../b"]);
    assert.deepEqual(out, ["a/a/a/b", "a/b"]);
  });

  it("Should crash on outside path", async () => {
    expectBuilderError(
      () => assertDirChildren("a", ["../../q/q/a/c"]),
      ERRORS.BUILTIN_TASKS.SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY,
      "../../q/q/a/c");
  });
});

describe("assertDirectDirChildren", () => {
  it("Should pass for children inputs", async () => {
    const out = assertDirectDirChildren(
      "a",
      ["a/b", "a/c", "a/d", "./a/e", "a/../a/f", "a/x/y/z/../../../g"]);
    assert.deepEqual(out, ["a/b", "a/c", "a/d", "a/e", "a/f", "a/g"]);
  });

  it("Should crash on deep path", async () => {
    expectBuilderError(
      () => assertDirectDirChildren("a", ["a/b/c"]),
      ERRORS.BUILTIN_TASKS.DEPLOY_SCRIPT_NON_DIRECT_CHILD,
      "a/b/c");
  });

  it("Should crash on outside path", async () => {
    expectBuilderError(
      () => assertDirectDirChildren("a", ["a/../b/1"]),
      ERRORS.BUILTIN_TASKS.DEPLOY_SCRIPT_NON_DIRECT_CHILD,
      "b/1");
  });
});
