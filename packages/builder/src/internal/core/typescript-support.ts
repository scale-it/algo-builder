import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";

import { ExecutionMode, getExecutionMode } from "./execution-mode";

const NODE_MODULES_DIR = "node_modules";

function getBuilderNodeModules() {
  return __dirname.substring(
    0,
    __dirname.lastIndexOf(NODE_MODULES_DIR) + NODE_MODULES_DIR.length
  );
}

let cachedIsTypescriptSupported: boolean | undefined;

export function isTypescriptSupported(): boolean {
  if (cachedIsTypescriptSupported === undefined) {
    const executionMode = getExecutionMode();
    if (executionMode === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION) {
      cachedIsTypescriptSupported = false;
    } else if (
      executionMode === ExecutionMode.EXECUTION_MODE_LOCAL_INSTALLATION
    ) {
      const nodeModules = getBuilderNodeModules();
      cachedIsTypescriptSupported =
        fs.existsSync(path.join(nodeModules, "typescript")) &&
        fs.existsSync(path.join(nodeModules, "ts-node"));
    } else {
      // We are inside this project (e.g. running tests), or Builder is
      // linked and we can't get the Builder project's node_modules, so we
      // return true.
      //
      // This is safe because Builder will use this project's installation of
      // TypeScript and ts-node. We need them for compilation and testing, so
      // they'll always be installed.
      cachedIsTypescriptSupported = true;
    }
  }

  return cachedIsTypescriptSupported;
}

export function loadTsNodeIfPresent(): void {
  if (isTypescriptSupported()) {
    // See: https://github.com/nomiclabs/builder/issues/265
    if (process.env.TS_NODE_FILES === undefined) {
      process.env.TS_NODE_FILES = "true";
    }

    try {
      // tslint:disable-next-line no-implicit-dependencies
      require("ts-node/register");
    } catch (error) {
      // See: https://github.com/nomiclabs/builder/issues/274
      if (error.message.includes("Cannot find module 'typescript'")) {
        console.warn(
          chalk.yellow(
            "Failed to load TypeScript support. Please update ts-node."
          )
        );

        return;
      }

      // tslint:disable-next-line only-builder-error
      throw error;
    }
  }
}
