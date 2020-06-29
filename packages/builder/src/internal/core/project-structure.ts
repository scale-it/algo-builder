import findUp from "find-up";
import fsExtra from "fs-extra";
import path from "path";

import { getPackageRoot } from "../util/package-info";

import { BuilderError } from "./errors";
import { ERRORS } from "./errors-list";
import { isTypescriptSupported } from "./typescript-support";
const JS_CONFIG_FILENAME = "builder.config.js";
const TS_CONFIG_FILENAME = "builder.config.ts";

export function isCwdInsideProject() {
  return (
    Boolean(findUp.sync(JS_CONFIG_FILENAME)) ||
      isTypescriptSupported() && Boolean(findUp.sync(TS_CONFIG_FILENAME))
  );
}

export function getUserConfigPath(): string | undefined {
  const tsConfigPath = findUp.sync(TS_CONFIG_FILENAME);
  if (tsConfigPath) {
    if (isTypescriptSupported()) {
      return tsConfigPath;
    }
    throw "TypeScript config was found but TypeScript is not supported."
  }

  return findUp.sync(JS_CONFIG_FILENAME);
}
