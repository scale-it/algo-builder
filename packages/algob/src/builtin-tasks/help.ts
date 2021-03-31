import { HelpPrinter } from "../internal/cli/help-printer";
import { ALGOB_NAME } from "../internal/constants";
import { task } from "../internal/core/config/config-env";
import { ALGOB_PARAM_DEFINITIONS } from "../internal/core/params/builder-params";
import { getPackageJson } from "../internal/util/package-info";
import { RuntimeEnv } from "../types";
import { TASK_HELP } from "./task-names";

export default function (): void {
  task(TASK_HELP, "Prints this message")
    .addOptionalPositionalParam(
      "task",
      "An optional task to print more info about"
    )
    .setAction(help);
}

async function help ({ task: taskName }: { task?: string }, env: RuntimeEnv): Promise<void> {
  const packageJson = await getPackageJson();
  const helpPrinter = new HelpPrinter(
    ALGOB_NAME,
    packageJson.version,
    ALGOB_PARAM_DEFINITIONS,
    env.tasks
  );

  if (taskName !== undefined) {
    helpPrinter.printTaskHelp(taskName);
    return;
  }

  helpPrinter.printGlobalHelp();
}
