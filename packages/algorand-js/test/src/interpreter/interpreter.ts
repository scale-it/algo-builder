import { assert } from "chai";
import path from "path";

import { Interpreter } from "../../../src/interpreter/interpreter";
import { toBytes } from "../../../src/lib/parse-data";
import { useFixtureProject } from "../../helpers/project";

describe("Interpreter", function () {
  useFixtureProject("teal-files");
  const interpreter = new Interpreter();

  it("should accept logic on valid teal code", async function () {
    const args = [toBytes("")];
    interpreter.args = args;
    const filePath = path.join(process.cwd(), 'test-file-4.teal');
    const result = await interpreter.execute(filePath, args, {} as any);
    assert.deepEqual(result, {} as any);
  });
});
