import { Algodv2 } from "algosdk";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";

import { compile } from "../../src/builtin-tasks/compile";
import { ASSETS_DIR } from "../../src/internal/core/project-structure";
import { CompileOp, PyCompileOp } from "../../src/lib/compile";
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
      srcHash: tealHash,
      toBytes: new Uint8Array(1)
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
  const f3 = "gold-asa.py";
  const f4 = "gold-asa.teal";
  const fhash = 2374470440; // murmur3 hash for f1 file

  it("on first run it should compile all .teal sources", async () => {
    await op.resetAndCompile(false);

    assert.equal(op.timestamp, 4);
    assert.deepEqual(op.compiledFiles, [
      { filename: f1, tealHash: fhash },
      { filename: f2, tealHash: fhash },
      { filename: f3, tealHash: 3867907430 },
      { filename: f4, tealHash: 3649244736 }]);

    const writtenFiles = [];
    for (const fn of [f1, f2, f3, f4]) {
      const fullF = path.join(cacheDir, fn + ".yaml");
      writtenFiles.push(fullF);
      assert.isTrue(fs.existsSync(fullF));
    }
    assert.deepEqual(op.writtenFiles, writtenFiles);
  });

  it("shouldn't recompile when files didn't change", async () => {
    await op.resetAndCompile(false);

    assert.equal(op.timestamp, 4);
    assert.lengthOf(op.compiledFiles, 0);
    assert.lengthOf(op.writtenFiles, 0);
  });

  it("should recompile only changed files", async () => {
    const content = "// comment";
    fs.writeFileSync(path.join(ASSETS_DIR, f2), content);
    await op.resetAndCompile(false);

    assert.equal(op.timestamp, 5);
    assert.deepEqual(op.compiledFiles, [
      { filename: f2, tealHash: murmurhash.v3(content) }]);
    assert.deepEqual(op.writtenFiles, [
      path.join(cacheDir, f2 + ".yaml")]);
  });

  it("should recompile all files when --force is used", async () => {
    await op.resetAndCompile(true);

    assert.equal(op.timestamp, 9);
    assert.lengthOf(op.compiledFiles, 4);
    assert.lengthOf(op.writtenFiles, 4);
  });

  it("should return TEAL code", async () => {
    const pyOp = new PyCompileOp(op);
    const content = fs.readFileSync(path.join(ASSETS_DIR, f4), 'utf8');
    const res = pyOp.compilePyTeal(f3) + '\n';
    assert.deepEqual(content.toString(), res);
  });
});
