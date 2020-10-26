import type { Algodv2, CompileOut } from "algosdk";
import * as fs from 'fs';
import * as path from 'path';
import YAML from "yaml";

import { parseAlgorandError } from "../internal/core/errors";
import { assertDir, ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { timestampNow } from "../lib/time";
import type { ASCCache } from "../types";
const murmurhash = require('murmurhash'); // eslint-disable-line @typescript-eslint/no-var-requires

export const tealExt = ".teal";
export const msigExt = ".msig";

export class CompileOp {
  algocl: Algodv2;
  cacheAssured = false;

  constructor (algocl: Algodv2) {
    this.algocl = algocl;
  }

  // Gets the TEAL compiled result from artifacts cache and compiles the code if necessary.
  // Will throw an exception if the source file doesn't exists.
  // @param filename: name of the TEAL code in `/assets` directory.
  //   (Examples: `mysc.teal, security/rbac.teal`)
  //   MUST have a .teal or .msig extension
  // @param force: if true it will force recompilation even if the cache is up to date.
  async ensureCompiled (filename: string, force: boolean): Promise<ASCCache> {
    if (!filename.endsWith(tealExt) && !filename.endsWith(msigExt)) {
      throw new Error(`filename "${filename}" must end with "${tealExt}" or "${msigExt}"`); // TODO: convert to buildererror
    }

    const [teal, thash] = this.readTealAndHash(path.join(ASSETS_DIR, filename));
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

  // returns teal code, hash extracted from dissembled .msig file (part above `LogicSig: `)
  // {refer - /assets/sample-text-asc.msig}
  // returns teal code(whole file content) along with hash if extension is .teal
  readTealAndHash (filename: string): [string, number] {
    const content = fs.readFileSync(filename, 'utf8');

    if (filename.endsWith(msigExt)) {
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
      if (e?.errno === -2) { return undefined; } // errno whene reading an unexisting file
      throw e;
    }
  }

  callCompiler (code: string): Promise<CompileOut> {
    return this.algocl.compile(code).do();
  }

  async compile (filename: string, tealCode: string, tealHash: number): Promise<ASCCache> {
    try {
      const co = await this.callCompiler(tealCode);
      return {
        filename: filename,
        timestamp: timestampNow(),
        compiled: co.result,
        compiledHash: co.hash,
        srcHash: tealHash,
        // compiled base64 converted into bytes
        toBytes: new Uint8Array(Buffer.from(co.result, "base64"))
      };
    } catch (e) {
      throw parseAlgorandError(e, { filename: filename });
    }
  }

  writeFile (filename: string, content: string): void {
    fs.writeFileSync(filename, content);
  }
}
