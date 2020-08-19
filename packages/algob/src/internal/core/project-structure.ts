import * as findUp from "find-up";
import * as fs from "fs";
import { join } from "path";
const fsp = fs.promises;

export const JS_CONFIG_FILENAME = "algob.config.js";
// export const TS_CONFIG_FILENAME = "algob.config.ts";

export const ASSETS_DIR = "assets";
export const ARTIFACTS_DIR = "artifacts";
export const CACHE_DIR = join(ARTIFACTS_DIR, "cache");

export function isCwdInsideProject (): boolean {
  return Boolean(findUp.sync(JS_CONFIG_FILENAME));
}

export function getUserConfigPath (): string | undefined {
  return findUp.sync(JS_CONFIG_FILENAME);
}

export async function assertAllDirs (): Promise<void> {
  const tasks = [];
  for (const d of [ASSETS_DIR]) {
    tasks.push(assertDir(d));
  }
  await Promise.all(tasks);
}

export async function assertDir (dirname: string): Promise<void> {
  try {
    await fsp.access(dirname, fs.constants.F_OK);
  } catch (e) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}
