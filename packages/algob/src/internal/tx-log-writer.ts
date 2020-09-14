import fs from "fs";
import path from "path";
import YAML from "yaml";

import { ARTIFACTS_DIR } from "./core/project-structure";

export interface txWriter {
  timestamp: number
  scriptName: string
  setScriptName: (scriptName: string) => void
  push: (msg: string, obj: any) => void
  ensureDirectoryExistence: (filePath: string) => void
}

export class TxWriterImpl implements txWriter {
  timestamp: number;
  scriptName: string;
  constructor (scriptName: string) {
    this.timestamp = +new Date();
    this.scriptName = scriptName;
  }

  setScriptName (scriptName: string): void {
    this.scriptName = scriptName;
  }

  ensureDirectoryExistence (filePath: string): void {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return;
    }
    this.ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
  }

  push (msg: string, obj: any): void {
    this.timestamp = +new Date();

    const filePath = path.join(ARTIFACTS_DIR, this.scriptName) + '.' +
    (this.timestamp).toString() + '.log';

    this.ensureDirectoryExistence(filePath);
    var map = new Map();
    map.set(msg, obj);
    YAML.defaultOptions.indent = 4;
    var file = YAML.stringify(map);
    fs.appendFileSync(filePath, file);
  }
}
