import path from "path";
import fs from "fs";

// takes file name as input and returns program as string
export function getProgram (fileName: string): string {
  const filePath = path.join(process.cwd(), 'test', 'teal-files', fileName);
  return fs.readFileSync(filePath, 'utf8');
}