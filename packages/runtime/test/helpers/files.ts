import fs from "fs";
import path from "path";

// takes file name as input and returns program as string
export function getProgram (fileName: string): string {
  const filePath = path.join(process.cwd(), 'assets', fileName);
  return fs.readFileSync(filePath, 'utf8');
}
