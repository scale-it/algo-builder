import { readdirSync } from 'fs';

import { task } from "../internal/core/config/config-env";
import { assertDir, ASSETS_DIR, CACHE_DIR } from "../internal/core/project-structure";
import { cmpStr } from "../lib/comparators";
import { CompileOp, tealExt } from "../lib/compile";
import { createClient } from "../lib/driver";
import type { AlgobRuntimeEnv } from "../types";
import { TASK_COMPILE } from "./task-names";

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

  for (const f of readdirSync(ASSETS_DIR).sort(cmpStr)) {
    if (!f.endsWith(tealExt)) { continue; }
    await op.ensureCompiled(f, force);
  }
}
