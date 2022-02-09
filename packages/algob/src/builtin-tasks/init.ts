import { createProject } from "../internal/cli/project-creation";
import { task } from "../internal/core/config/config-env";
import { TASK_INIT } from "./task-names";

export default function (): void {
  task(TASK_INIT, "Initializes a new project(JS by default) in the given directory")
    .addPositionalParam<string>("newProjectLocation", "Location of the new project")
    .addFlag(
      "typescript",
      "Initializes a new typescript project in the given directory"
    )
    .addFlag(
      "noInfrastructure",
      'Initializes a new project without infrastructure folder'
    )
    .setAction(async ({ newProjectLocation, typescript, noInfrastructure }:
    { newProjectLocation: string, typescript: boolean, noInfrastructure: boolean }, _) => {
      await createProject(newProjectLocation, typescript, noInfrastructure);
    });
}
