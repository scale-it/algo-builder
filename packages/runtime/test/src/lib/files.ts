import { assert } from "chai";
import path from "path";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { ASSETS_DIR } from "../../../src/lib/asa";
import { getPathFromDirRecursive } from "../../../src/lib/files";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

describe("Load file from assets dir recursive", function () {
  useFixture("subdir-project");

  it("should return correct path for teal files from nested folders in /assets", function () {
    let filePath = getPathFromDirRecursive(ASSETS_DIR, "file1.teal");
    let execptedPath = path.join(ASSETS_DIR, 'file1.teal');
    assert.equal(filePath, execptedPath);

    filePath = getPathFromDirRecursive(ASSETS_DIR, "file2.teal");
    execptedPath = path.join(ASSETS_DIR, 'folder-2', 'file2.teal');
    assert.equal(filePath, execptedPath);

    filePath = getPathFromDirRecursive(ASSETS_DIR, "file3.teal");
    execptedPath = path.join(ASSETS_DIR, 'folder-1', 'folder-3', 'file3.teal');
    assert.equal(filePath, execptedPath);

    filePath = getPathFromDirRecursive(ASSETS_DIR, "file4.teal");
    execptedPath = path.join(ASSETS_DIR, 'folder-1', 'folder-3', 'folder-4', 'file4.teal');
    assert.equal(filePath, execptedPath);
  });

  it("should throw error if file with same name is present in assets", function () {
    expectRuntimeError(
      () => getPathFromDirRecursive(ASSETS_DIR, "duplicate-file.teal"),
      RUNTIME_ERRORS.GENERAL.MULTIPLE_FILES_WITH_SAME_NAME_IN_DIR
    );
  });

  it("should throw error if file is not found", function () {
    expectRuntimeError(
      () => getPathFromDirRecursive(ASSETS_DIR, "random-file.teal"),
      RUNTIME_ERRORS.GENERAL.FILE_NOT_FOUND_IN_DIR
    );
  });

  it("should return with warning message in case file is not found and warnMsg is passed", function () {
    const stub = console.warn as sinon.SinonStub;
    stub.reset();

    const warnMsg = "File was not found";
    getPathFromDirRecursive(ASSETS_DIR, "random-file.teal", warnMsg);
    assert(stub.calledWith(warnMsg));
  });

  it("should return correct path for assets/**/asa.yaml", function () {
    const filePath = getPathFromDirRecursive(ASSETS_DIR, "asa.yaml");
    const execptedPath = path.join(ASSETS_DIR, 'folder-1', 'asa.yaml');
    assert.equal(filePath, execptedPath);
  });
});
