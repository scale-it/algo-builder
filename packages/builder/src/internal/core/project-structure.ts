import * as findUp from "find-up";
import * as fs from "fs";
const fsp = fs.promises;

export const JS_CONFIG_FILENAME = "algob.config.js";
// export const TS_CONFIG_FILENAME = "algob.config.ts";

export const ASSETS_DIR = "assets";

export function isCwdInsideProject(): boolean {
  return Boolean(findUp.sync(JS_CONFIG_FILENAME));
}

export function getUserConfigPath(): string | undefined {
  return findUp.sync(JS_CONFIG_FILENAME);
}

export async function assertAllDirs(): Promise<void> {
  const tasks = []
  for (const d of [ASSETS_DIR]) {
    tasks.push(assertDir(d));
  }
  await Promise.all(tasks);
}

async function assertDir(dirname: string) {
  try {
    await fsp.access(dirname, fs.constants.F_OK)
  } catch (e) {
    fs.mkdirSync(dirname);
  }
}
