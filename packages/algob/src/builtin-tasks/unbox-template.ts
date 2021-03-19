import { unbox } from "../internal/cli/unbox-template";
import { task } from "../internal/core/config/config-env";
import { TASK_UNBOX_TEMPLATE } from "./task-names";

export default function (): void {
  task(TASK_UNBOX_TEMPLATE, "Unboxes a new dapp template using algo-builder")
    .addFlag(
      "force",
      "Unbox project in the current directory regardless of its " +
      "state. Be careful, this\n                will overwrite files " +
      "that exist in the directory."
    )
    .addOptionalPositionalParam<string>(
    "templateName",
    "Name of the dapp template. If no template is specified, a default " +
        "template(bare) will be downloaded."
  )
    .addOptionalPositionalParam<string>(
    "destination",
    "Path to the directory in which you would like to unbox the project files. " +
        "If destination is\n                not provided, this defaults to the current directory.\n"
  )
    .setAction((input, _) => unbox(input));
}
