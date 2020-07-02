import path from "path";

import {
  TASK_CLEAN,
  TASK_CONSOLE,
  TASK_HELP,
  TASK_INIT,
  TASK_RUN,
  TASKS_TEST
} from "../../../builtin-tasks/task-names"
import { loadPluginFile } from "../plugins";

export default function () : void{
  [
    TASK_HELP,
    TASK_CONSOLE,
    TASK_CLEAN,
    TASK_INIT,
    TASK_RUN,
    TASKS_TEST
  ].forEach(taskName => {
    loadPluginFile(
      path.join(__dirname, "..", "..", "..", "builtin-tasks", taskName)
    );
  })

}
