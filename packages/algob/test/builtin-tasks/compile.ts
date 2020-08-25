import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";

import { compile, CompileOp } from "../../src/builtin-tasks/compile";
import { mkAlgobEnv } from "../helpers/params";
import { useFixtureProjectCopy } from "../helpers/project";
import type { ASCCache } from "../../src/types";


interface CompileIn {
  filename: string,
  tealHash: number
}

class CompileOpMock {
  timestamp = 0;
  compiledFiles = [] as CompileIn[];
  writtenFiles = [] as string[];

  async compile (filename: string, _tealCode: string, tealHash: number): Promise<ASCCache> {
    this.compiledFiles.push({filename, tealHash})
    this.timestamp++;
    return {
      filename: filename,
      timestamp: this.timestamp,
      compiled: "compiled",
      compiledHash: "compiledHash",
      srcHash: tealHash
    };
  }

  writeFile (filename:string, _content: string): void {
    this.writtenFiles.push(filename);
  }
}

describe("Compile task", () => {
  useFixtureProjectCopy("default-config-project");
  let op: CompileOp = new CompileOpMock();

  let cacheDir = path.join("artifacts", "cache");

  it("on first run it should compile all .teal sources", async () => {
    await compile(false, op);
    const f1 = "asc-fee-check.teal";
    const f2 = "asc-fee-check-copy.teal"

    assert.equal(op.timestamp, 2);
    assert.deepEqual(op.compiledFiles, [
      {filename: f1, tealHash: 1},
      {filename: f2, tealHash: 1}]);
    assert.deepEqual(op.writtenFiles, [
      path.join(cacheDir, f1 + ".yaml"), path.join(cacheDir, f2 + ".yaml"),
    ])
  });

  it("shouldn't recompile when files didn't change", async()=>{
    op.compiledFiles = [];
    op.writtenFiles = [];
    await compile(false, op);

    assert.equal(op.timestamp, 2);
    assert.lengthOf(op.compiledFiles, 0);
    assert.lengthOf(op.writtenFiles, 0);
  })

});
