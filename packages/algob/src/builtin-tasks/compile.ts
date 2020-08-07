import { task } from "../internal/core/config/config-env";
// import { createClient } from "../lib/driver";
// import { AlgobRuntimeEnv, TaskArguments } from "../types";
import { TASK_COMPILE } from "./task-names";

export default function (): void {
  task(TASK_COMPILE, "Compilation task")
    .setAction(
      async () => {
        console.log("compiling......");
      }
    );
}
