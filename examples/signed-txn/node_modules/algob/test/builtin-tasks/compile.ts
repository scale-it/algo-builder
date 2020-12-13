import { Algodv2 } from "algosdk";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";

import { compile } from "../../src/builtin-tasks/compile";
import { ASSETS_DIR } from "../../src/internal/core/project-structure";
import { CompileOp } from "../../src/lib/compile";
import type { ASCCache } from "../../src/types";
import { useFixtureProjectCopy } from "../helpers/project";
const murmurhash = require('murmurhash'); // eslint-disable-line @typescript-eslint/no-var-requires

interface CompileIn {
  filename: string
  tealHash: number
}

class CompileOpMock extends CompileOp {
  timestamp = 0;
  compiledFiles = [] as CompileIn[];
  writtenFiles = [] as string[];

  async compile (filename: string, _tealCode: string, tealHash: number): Promise<ASCCache> {
    this.compiledFiles.push({ filename, tealHash });
    this.timestamp++;
    return {
      filename: filename,
      timestamp: this.timestamp,
      compiled: "compiled",
      compiledHash: "compiledHash",
      srcHash: tealHash
    };
  }

  writeFile (filename: string, _content: string): void {
    this.writtenFiles.push(filename);
    super.writeFile(filename, _content);
  }

  resetAndCompile (force: boolean): Promise<void> {
    this.compiledFiles = [];
    this.writtenFiles = [];
    return compile(force, this);
  }
}

describe("Compile task", () => {
  useFixtureProjectCopy("config-project");
  const fakeAlgod: Algodv2 = {} as Algodv2; // eslint-disable-line @typescript-eslint/consistent-type-assertions
  const op = new CompileOpMock(fakeAlgod);

  const cacheDir = path.join("artifacts", "cache");
  const f1 = "asc-fee-check.copy.teal";
  const f2 = "asc-fee-check.teal";
  const fhash = 2374470440; // murmur3 hash for f1 file

  it("on first run it should compile all .teal sources", async () => {
    await op.resetAndCompile(false);

    assert.equal(op.timestamp, 2);
    assert.deepEqual(op.compiledFiles, [
      { filename: f1, tealHash: fhash },
      { filename: f2, tealHash: fhash }]);

    const writtenFiles = [];
    for (const fn of [f1, f2]) {
      const fullF = path.join(cacheDir, fn + ".yaml");
      writtenFiles.push(fullF);
      assert.isTrue(fs.existsSync(fullF));
    }
    assert.deepEqual(op.writtenFiles, writtenFiles);
  });

  it("shouldn't recompile when files didn't change", async () => {
    await op.resetAndCompile(false);

    assert.equal(op.timestamp, 2);
    assert.lengthOf(op.compiledFiles, 0);
    assert.lengthOf(op.writtenFiles, 0);
  });

  it("should recompile only changed files", async () => {
    const content = "// comment";
    fs.writeFileSync(path.join(ASSETS_DIR, f2), content);
    await op.resetAndCompile(false);

    assert.equal(op.timestamp, 3);
    assert.deepEqual(op.compiledFiles, [
      { filename: f2, tealHash: murmurhash.v3(content) }]);
    assert.deepEqual(op.writtenFiles, [
      path.join(cacheDir, f2 + ".yaml")]);
  });

  it("should recompile all files when --force is used", async () => {
    await op.resetAndCompile(true);

    assert.equal(op.timestamp, 5);
    assert.lengthOf(op.compiledFiles, 2);
    assert.lengthOf(op.writtenFiles, 2);
  });
});
