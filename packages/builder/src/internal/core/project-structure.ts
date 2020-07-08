import * as findUp from "find-up";

export const JS_CONFIG_FILENAME = "algob.config.js";
// export const TS_CONFIG_FILENAME = "algob.config.ts";

export function isCwdInsideProject() : boolean {
  return Boolean(findUp.sync(JS_CONFIG_FILENAME));
}

export function getUserConfigPath(): string | undefined {
  return findUp.sync(JS_CONFIG_FILENAME);
}
