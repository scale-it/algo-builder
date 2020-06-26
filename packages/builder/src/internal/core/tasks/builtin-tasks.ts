import path from "path";

import { loadPluginFile } from "../plugins";

export default function () {
  ["console", "help", "clean"]
    .forEach(taskName => {
      loadPluginFile(
        path.join(__dirname, "..", "..", "..", "builtin-tasks", taskName)
      );
    })

}
