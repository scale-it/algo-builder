import findUp from "find-up";

export const JS_CONFIG_FILENAME = "algob.config.js";
export const TS_CONFIG_FILENAME = "algob.config.ts";

export function isCwdInsideProject() : boolean {
  return Boolean(findUp.sync(JS_CONFIG_FILENAME));
}

export function getUserConfigPath(): string | undefined {
  if (findUp.sync(TS_CONFIG_FILENAME)) {
    throw "TypeScript config was found but TypeScript is not supported."
  }

  return findUp.sync(JS_CONFIG_FILENAME);
}
