import fs from "fs";
import path from "path";
import YAML from "yaml";

import { ARTIFACTS_DIR } from "../internal/core/project-structure";

export interface txWriter {

  timestamp: number
  push: (scriptPath: string, msg: string, obj: any) => void
  ensureDirectoryExistence: (filePath: string) => boolean

}

export class TxWriterImpl implements txWriter {
  timestamp: number;

  constructor () {
    this.timestamp = +new Date();
  }

  ensureDirectoryExistence (filePath: string): boolean {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    this.ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
    return true;
  }

  push (scriptPath: string, msg: string, obj: any): void {
    this.timestamp = +new Date();

    const filePath = path.join(ARTIFACTS_DIR, scriptPath) + '.' +
    (this.timestamp).toString() + '.log';

    this.ensureDirectoryExistence(filePath);
    fs.appendFileSync(
      filePath,
      msg + YAML.stringify(obj)
    );
  }
}
