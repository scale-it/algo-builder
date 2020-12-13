import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { AlgobRuntimeEnv } from "../types";
import { TASK_CLEAN } from "./task-names";

export default function (): void {
  task(
    TASK_CLEAN,
    "Clears the cache and deletes all artifacts",
    async (_, { config }: AlgobRuntimeEnv) => {
      if (config.paths == null) {
        return;
      }
      await fsExtra.remove(config.paths.cache);
      await fsExtra.remove(config.paths.artifacts);
    }
  );
}
