import { getProgram } from "algob/test/helpers/fs";
import { assert } from "chai";

import { Interpreter } from "../../../src/interpreter/interpreter";
import { toBytes } from "../../../src/lib/parsing";
import { useFixtureProject } from "../../helpers/project";

describe("Interpreter", function () {
  useFixtureProject("teal-files");
  const interpreter = new Interpreter();

  it("should accept logic on valid teal code", async function () {
    const args = [toBytes("")];
    interpreter.args = args;
    const result = await interpreter.execute(getProgram('test-file-4.teal'), args, {} as any);
    assert.deepEqual(result, {} as any);
  });
});
