import path from "path";

import { loadPluginFile } from "../plugins";
import {
  TASK_HELP,
  TASK_CONSOLE,
  TASK_CLEAN,
  TASK_INIT
} from "../../../builtin-tasks/task-names"

export default function () {
  [
    TASK_HELP,
    TASK_CONSOLE,
    TASK_CLEAN,
    TASK_INIT
  ].forEach(taskName => {
    loadPluginFile(
      path.join(__dirname, "..", "..", "..", "builtin-tasks", taskName)
    );
  })

}
