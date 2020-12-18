import fs from "fs";
import fsExtra from "fs-extra";
import * as os from "os";
import path from "path";

import { ASSETS_DIR } from "../../src/internal/core/project-structure";

declare module "mocha" {
  interface Context {
    tmpDir: string
  }
}

async function getEmptyTmpDir (nameHint: string): Promise<string> {
  const tmpDirContainer = os.tmpdir();
  const tmpDir = path.join(tmpDirContainer, `algob-tests-${nameHint}`);
  await fsExtra.ensureDir(tmpDir);
  await fsExtra.emptyDir(tmpDir);

  return tmpDir;
}

export function useTmpDir (nameHint: string): void {
  nameHint = nameHint.replace(/\s+/, "-");

  beforeEach("Creating tmp dir", async function () {
    this.tmpDir = await getEmptyTmpDir(nameHint);
  });
}

// takes file name as input and returns program as string
export function getProgram (fileName: string): string {
  const filePath = path.join(process.cwd(), ASSETS_DIR, fileName);
  return fs.readFileSync(filePath, 'utf8');
}
