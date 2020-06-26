import path from "path";

import { loadPluginFile } from "../plugins";

export default function () {
  loadPluginFile(
    path.join(__dirname, "..", "..", "..", "builtin-tasks", "console")
  );

  loadPluginFile(
    path.join(__dirname, "..", "..", "..", "builtin-tasks", "help")
  );

  loadPluginFile(
    path.join(__dirname, "..", "..", "..", "builtin-tasks", "clean")
  );
}
