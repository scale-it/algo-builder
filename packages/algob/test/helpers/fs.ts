import fsExtra from "fs-extra";
import * as os from "os";
import path from "path";

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
