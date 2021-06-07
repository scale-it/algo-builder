import { lsTreeWalk } from '@algo-builder/runtime';
import { readdirSync } from 'fs';
import path from "path";

import { task } from "../internal/core/config/config-env";
import { assertDir, ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { cmpStr } from "../lib/comparators";
import { CompileOp, pyExt, tealExt } from "../lib/compile";
import { createClient } from "../lib/driver";
import type { RuntimeEnv } from "../types";
import { TASK_COMPILE } from "./task-names";

const ALGOBPY_DIR = 'algobpy';

export default function (): void {
  task(TASK_COMPILE, "Compile all TEAL smart contracts")
    .addFlag("force", "recompile even if the source file didn't change")
    .setAction(compileTask);
}

export interface TaskArgs {
  force: boolean
}

function compileTask ({ force }: TaskArgs, env: RuntimeEnv): Promise<void> {
  const op = new CompileOp(createClient(env.network));
  return compile(force, op);
}

export async function compile (force: boolean, op: CompileOp): Promise<void> {
  await assertDir(CACHE_DIR);
  const paths = lsTreeWalk(ASSETS_DIR);

  for (const p of paths.sort(cmpStr)) {
    const f = path.basename(p);
    if ((!f.endsWith(tealExt) && !f.endsWith(pyExt)) || p.includes(ALGOBPY_DIR)) { continue; }
    await op.ensureCompiled(f, force);
  }
}
