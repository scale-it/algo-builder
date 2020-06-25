import path from "path";

import { loadPluginFile } from "../plugins";

export default function () {
  loadPluginFile(
    path.join(__dirname, "..", "..", "..", "builtin-tasks", "develop")
  );

  loadPluginFile(
    path.join(__dirname, "..", "..", "..", "builtin-tasks", "help")
  );
}
