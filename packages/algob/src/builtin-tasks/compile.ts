import type { Algodv2, CompileOut } from "algosdk";
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import YAML from "yaml";

import { task } from "../internal/core/config/config-env";
import { parseAlgorandError } from "../internal/core/errors";
import { assertDir, ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { cmpStr } from "../lib/comparators";
import { createClient } from "../lib/driver";
import { timestampNow } from "../lib/time";
import type { AlgobRuntimeEnv, ASCCache } from "../types";
import { TASK_COMPILE } from "./task-names";
const murmurhash = require('murmurhash'); // eslint-disable-line @typescript-eslint/no-var-requires

const tealExt = ".teal";

export default function (): void {
  task(TASK_COMPILE, "Compile all TEAL smart contracts")
    .addFlag("force", "recompile even if the source file didn't change")
    .setAction(compileTask);
}

export interface TaskArgs {
  force: boolean
}

function compileTask ({ force }: TaskArgs, env: AlgobRuntimeEnv): Promise<void> {
  const op = new CompileOp(createClient(env.network));
  return compile(force, op);
}

export async function compile (force: boolean, op: CompileOp): Promise<void> {
  await assertDir(CACHE_DIR);
  const cache = readArtifacts(CACHE_DIR);

  for (const f of readdirSync(ASSETS_DIR).sort(cmpStr)) {
    if (!f.endsWith(tealExt)) { continue; }

    let c = cache.get(f);
    const [teal, thash] = readTealAndHash(path.join(ASSETS_DIR, f));
    if (!force && c !== undefined && c.srcHash === thash) {
      console.log(`smart-contract source "${f}" didn't change, skipping.`);
      continue;
    }
    console.log("compiling", f);
    c = await op.compile(f, teal, thash);
    cache.set(f, c);
    const cacheFilename = path.join(CACHE_DIR, f + ".yaml");
    op.writeFile(cacheFilename, YAML.stringify(c));
  }
}

export class CompileOp {
  algocl: Algodv2;

  constructor (algocl: Algodv2) {
    this.algocl = algocl;
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
        srcHash: tealHash
      };
    } catch (e) {
      throw parseAlgorandError(e, { filename: filename });
    }
  }

  writeFile (filename: string, content: string): void {
    writeFileSync(filename, content);
  }
}

function readArtifacts (dir: string): Map<string, ASCCache> {
  const cache = new Map<string, ASCCache>();
  for (const f of readdirSync(dir)) {
    const pathCFile = path.join(dir, f);
    const a = YAML.parse(readFileSync(pathCFile, 'utf8')) as ASCCache;
    cache.set(f.substring(0, f.length - tealExt.length), a);
  }
  return cache;
}

function readTealAndHash (filename: string): [string, number] {
  const content = readFileSync(filename, 'utf8');
  return [content, murmurhash.v3(content)];
}
