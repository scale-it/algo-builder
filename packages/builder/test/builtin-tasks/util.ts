import { assert } from "chai";
import sinon from "sinon";

import { getSortedScriptsNoGlob } from "../../src/builtin-tasks/util"

describe("Glob getSortedScriptsNoGlob", function () {
  it("Should sort scripts", async function () {
    const globStub = sinon.stub().returns(["q", "e", "w",  "a"])
    const sortedScripts = await getSortedScriptsNoGlob("directory", globStub)
    assert.deepEqual(sortedScripts, ["a", "e", "q", "w"])
    assert.deepEqual(globStub.getCall(0).args, [ "directory", {} ])
  });
})
