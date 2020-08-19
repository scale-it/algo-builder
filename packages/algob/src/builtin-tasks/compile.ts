import type { Algodv2, CompileOut } from "algosdk";
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import YAML from "yaml";

import { task } from "../internal/core/config/config-env";
import { assertDir, ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { createClient } from "../lib/driver";
import type { AlgobRuntimeEnv, ASCCache } from "../types";
import { TASK_COMPILE } from "./task-names";
const murmurhash = require('murmurhash'); // eslint-disable-line @typescript-eslint/no-var-requires

const tealExt = ".teal";

export default function (): void {
  task(TASK_COMPILE, "Compile all TEAL smart contracts")
    .addFlag("force", "recompile even if the source file didn't change")
    .setAction(compile);
}

export interface TaskArgs {
  force: boolean
}

async function compile ({ force }: TaskArgs, env: AlgobRuntimeEnv): Promise<void> {
  const algocl = createClient(env.network);
  await assertDir(CACHE_DIR);
  const cache = readArtifacts(CACHE_DIR);

  for (const f of readdirSync(ASSETS_DIR)) {
    if (!f.endsWith(tealExt)) { continue; }

    let c = cache.get(f);
    const [teal, thash] = readTealAndHash(path.join(ASSETS_DIR, f));
    if (!force && c !== undefined && c.srcHash === thash) {
      console.log(`smart-contract source "${f}" didn't change, skipping.`);
      continue;
    }
    console.log("compiling", f);
    c = await compileAndSave(algocl, new ASCCachePartial(f, teal, thash));
    cache.set(f, c);
    const cacheFilename = path.join(CACHE_DIR, f + ".yaml");
    writeFileSync(cacheFilename, YAML.stringify(c));
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

class ASCCachePartial {
  filename: string;
  tealCode: string;
  tealHash: number;

  constructor (filename: string, tealCode: string, tealHash: number) {
    this.filename = filename;
    this.tealCode = tealCode;
    this.tealHash = tealHash;
  }

  mkASCCache (co: CompileOut): ASCCache {
    return {
      filename: this.filename,
      timestamp: Math.floor(Date.now() / 1000),
      compiled: co.result,
      compiledHash: co.hash,
      srcHash: this.tealHash
    };
  }
}

async function compileAndSave (algocl: Algodv2, ap: ASCCachePartial): Promise<ASCCache> {
  try {
    const co = await algocl.compile(ap.tealCode).do();
    return ap.mkASCCache(co);
  } catch (e) {
    if (e?.statusCode === 400) {

    }
    throw e;
  }
}

class ASCCompileError extends Error {
  filename: string;
  constructor (msg: string, filename: string) {
    super(msg);
    this.filename = filename;
  }
}
