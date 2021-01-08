import fs from "fs";
import path from "path";

const ASSETS_DIR = "assets";

// takes file name as input and returns program as string
export function getProgram (fileName: string): string {
  const filePath = path.join(process.cwd(), ASSETS_DIR, fileName);
  return fs.readFileSync(filePath, 'utf8');
}
