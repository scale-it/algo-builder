import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";
import { RuntimeEnv } from "../types";
import { TASK_CLEAN } from "./task-names";

export default function (): void {
  task(
    TASK_CLEAN,
    "Clears the cache and deletes all artifacts",
    async (_, { config }: RuntimeEnv) => {
      if (config.paths == null) {
        console.warn("not in a project directory");
        return;
      }
      console.log("cleaning:\n    %s \n    %s", config.paths.cache, config.paths.artifacts);
      await fsExtra.remove(config.paths.cache);
      await fsExtra.remove(config.paths.artifacts);
    }
  );
}
