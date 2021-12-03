import { getPathFromDirRecursive, PyCompileOp } from "@algo-builder/runtime";
import { parseAlgorandError, types } from "@algo-builder/web";
import type { Algodv2, modelsv2 } from "algosdk";
import * as fs from 'fs';
import * as murmurhash from 'murmurhash';
import * as path from 'path';
import YAML from "yaml";

import { assertDir, ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { timestampNow } from "../lib/time";
import type { ASCCache, PyASCCache, SCParams } from "../types";

export const tealExt = ".teal";
export const pyExt = ".py";
export const lsigExt = ".lsig";

export class CompileOp {
  algocl: Algodv2;
  pyCompile: PyCompileOp;
  cacheAssured = false;

  constructor (algocl: Algodv2) {
    this.algocl = algocl;
    this.pyCompile = new PyCompileOp();
  }

  /** Gets the TEAL compiled result from artifacts cache and compiles the code if necessary.
   * Will throw an exception if the source file doesn't exists.
   * @param filename: name of the TEAL code in `/assets` directory.
   *   (Examples: `mysc.teal, security/rbac.teal`)
   *   MUST have a .teal, .lsig or .py extension
   * @param force: if true it will force recompilation even if the cache is up to date.
   * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
   */
  async ensureCompiled (filename: string, force?: boolean, scTmplParams?: SCParams):
  Promise<ASCCache | PyASCCache> {
    const filePath = getPathFromDirRecursive(ASSETS_DIR, filename) as string;

    if (force === undefined) {
      force = false;
    }

    if (!filename.endsWith(tealExt) && !filename.endsWith(lsigExt) && !filename.endsWith(pyExt)) {
      throw new Error(`filename "${filename}" must end with "${tealExt}" or "${lsigExt}" or "${pyExt}"`); // TODO: convert to buildererror
    }

    let teal: string;
    let thash: number;
    if (filename.endsWith(pyExt)) {
      const content = this.pyCompile.ensurePyTEALCompiled(filename, scTmplParams);
      [teal, thash] = [content, murmurhash.v3(content)];
    } else {
      [teal, thash] = this.readTealAndHash(filePath);
    }

    // const [teal, thash] = this.readTealAndHash(filePath);
    let a = await this.readArtifact(filename);
    if (!force && a !== undefined && a.srcHash === thash) {
      // '\x1b[33m%s\x1b[0m' for yellow color warning
      console.warn('\x1b[33m%s\x1b[0m', `smart-contract source "${filename}" didn't change, skipping.`);
      return a;
    }
    console.log("compiling", filename);
    a = await this.compile(filename, teal, thash);
    const cacheFilename = path.join(CACHE_DIR, filename + ".yaml");
    this.writeFile(cacheFilename, YAML.stringify(a));
    return a;
  }

  // returns teal code, hash extracted from dissembled .lsig file (part above `LogicSig: `)
  // {refer - /assets/sample-text-asc.lsig}
  // returns teal code(whole file content) along with hash if extension is .teal
  readTealAndHash (filename: string): [string, number] {
    const content = fs.readFileSync(filename, 'utf8');

    if (filename.endsWith(lsigExt)) {
      const teal = content.split("LogicSig: ")[0];
      return [teal, murmurhash.v3(content)];
    }
    return [content, murmurhash.v3(content)];
  }

  async readArtifact (filename: string): Promise<ASCCache | undefined> {
    await assertDir(CACHE_DIR);
    try {
      const p = path.join(CACHE_DIR, filename + ".yaml");
      return YAML.parse(await fs.promises.readFile(p, 'utf8')) as ASCCache;
    } catch (e) {
      if (types.isFileError(e) && e?.errno === -2) { return undefined; } // handling a not existing file
      throw e;
    }
  }

  callCompiler (code: string): Promise<modelsv2.CompileResponse> {
    return this.algocl.compile(code).do();
  }

  async compile (filename: string, tealCode: string, tealHash: number): Promise<ASCCache | PyASCCache> {
    try {
      const co = await this.callCompiler(tealCode);
      const result = {
        filename: filename,
        timestamp: timestampNow(),
        compiled: co.result,
        compiledHash: co.hash,
        srcHash: tealHash,
        // compiled base64 converted into bytes
        base64ToBytes: new Uint8Array(Buffer.from(co.result, "base64"))
      };
      return filename.endsWith(pyExt) ? { ...result, tealCode: tealCode } : result;
    } catch (e) {
      if (types.isRequestError(e)) { throw parseAlgorandError(e, { filename: filename }); }
      throw e;
    }
  }

  writeFile (filename: string, content: string): void {
    fs.writeFileSync(filename, content);
  }
}
