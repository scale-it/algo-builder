import fsExtra from "fs-extra";

import { task } from "../internal/core/config/config-env";

import { TASK_INIT } from "./task-names";

import { createProject } from "../internal/cli/project-creation";

export default function () {
  task(TASK_INIT, "Initializes a new project in the given directory")
    .addPositionalParam<string>("newProjectLocation", "Location of the new project")
    .setAction(async ({ newProjectLocation }: { newProjectLocation: string }, _) => {
      await createProject(newProjectLocation);
    });
}
