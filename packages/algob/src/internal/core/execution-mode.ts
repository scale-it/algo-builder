import debug from "debug";
import findupSync from "findup-sync";
import * as path from "path";

const log = debug("algob:core:execution-mode");

/**
 * This module defines different Algob execution modes and autodetects them.
 *
 * IMPORTANT: This will have to be revisited once Yarn PnP and npm's tink get
 * widely adopted.
 */
export enum ExecutionMode {
  EXECUTION_MODE_TS_NODE_TESTS,
  EXECUTION_MODE_LINKED,
  EXECUTION_MODE_GLOBAL_INSTALLATION,
  EXECUTION_MODE_LOCAL_INSTALLATION,
}

const workingDirectoryOnLoad = process.cwd();

export function getExecutionMode (): ExecutionMode {
  const isInstalled = __filename.includes("node_modules");

  if (!isInstalled) {
    // When running the tests with ts-node we set the CWD to the root of
    // algob. We could check if the __filename ends with .ts
    if (__dirname.startsWith(workingDirectoryOnLoad)) {
      return ExecutionMode.EXECUTION_MODE_TS_NODE_TESTS;
    }

    return ExecutionMode.EXECUTION_MODE_LINKED;
  }

  try {
    if (require("is-installed-globally") == null) {
      return ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION;
    }
  } catch (error) {
    log(
      "Failed to load is-installed-globally. Using alternative local installation detection\n",
      error
    );

    if (!alternativeIsLocalInstallation()) {
      return ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION;
    }
  }

  return ExecutionMode.EXECUTION_MODE_LOCAL_INSTALLATION;
}

/**
 * This is a somewhat more limited detection, but we use it if
 * is-installed-globally fails.
 *
 * If a user installs algob locally, and executes it from outside the
 * directory that contains the `node_module` with the installation, this will
 * fail and return `false`.
 */
function alternativeIsLocalInstallation (): boolean {
  let cwd = workingDirectoryOnLoad;

  while (true) {
    const nodeModules = findupSync("node_modules", { cwd });

    if (nodeModules === null || nodeModules === undefined) {
      return false;
    }

    if (__dirname.startsWith(nodeModules)) {
      return true;
    }

    cwd = path.join(nodeModules, "..", "..");
  }
}
