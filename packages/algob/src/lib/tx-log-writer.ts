import fs from "fs";
import path from "path";
import YAML from "yaml";

import { ARTIFACTS_DIR } from "../internal/core/project-structure";

export interface txWriter {

  timestamp: number
  push: (scriptPath: string, msg: string, obj: any) => void

}

export class TxWriterImpl implements txWriter {
  timestamp: number;

  constructor () {
    this.timestamp = +new Date();
  }

  push (scriptPath: string, msg: string, obj: any): void {
    this.timestamp = +new Date();

    fs.appendFileSync(
      path.join(ARTIFACTS_DIR, scriptPath) + '.' + (this.timestamp).toString() + '.log',
      msg + YAML.stringify(obj)
    );
  }
}
