import * as fs from "fs";
import { join } from "path";
const fsp = fs.promises;
import findupSync from "findup-sync";

export const JS_CONFIG_FILENAME = "algob.config.js";
// export const TS_CONFIG_FILENAME = "algob.config.ts";

export const ASSETS_DIR = "assets";
export const ARTIFACTS_DIR = "artifacts";
export const CACHE_DIR = join(ARTIFACTS_DIR, "cache");

export function isCwdInsideProject (): boolean {
  return Boolean(findupSync(JS_CONFIG_FILENAME));
}

export function getUserConfigPath (): string | undefined {
  return findupSync(JS_CONFIG_FILENAME) ?? undefined;
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
