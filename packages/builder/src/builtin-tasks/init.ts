import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";

import { TASK_INIT } from "./task-names";

import { createProject } from "../internal/cli/project-creation";

export default function () {
  task(
    TASK_INIT,
    "Initializes a new project in a current directory",
    async (_, { config }) => {
      await createProject();
    }
  );
}
