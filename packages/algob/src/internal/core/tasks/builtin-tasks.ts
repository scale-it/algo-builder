import * as path from "path";

import * as tasks from "../../../builtin-tasks/task-names";
import { loadPluginFile } from "../plugins";

export default function (): void{
  const ts = new Map(Object.entries(tasks));
  ts.delete('TASK_TEST_EXAMPLE');
  ts.delete('TASK_TEST_GET_TEST_FILES');

  const basedir = path.join(__dirname, "..", "..", "..", "builtin-tasks");
  for (const t of ts) {
    loadPluginFile(path.join(basedir, t[1]));
  }
}

// checks if the task name is not a setup kind of task
export function isSetupTask (taskName: string): boolean {
  return taskName === tasks.TASK_HELP ||
    taskName === tasks.TASK_INIT;
}
