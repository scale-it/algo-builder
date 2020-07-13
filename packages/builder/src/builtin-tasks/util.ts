
import util from "util";
import globModule from "glob";

export async function glob(pattern: string, params?: any): Promise<string[]> {
  return util.promisify(globModule)(pattern, params || { realpath: true });
}

export async function getSortedScriptsNoGlob(
  directory: string,
  globFn: (pattern: string, params?: any) => Promise<string[]>
): Promise<string[]> {
  return (await globFn(directory, {})).sort()
}

export function getSortedScripts(directory: string): Promise<string[]> {
  return getSortedScriptsNoGlob(directory, glob)
}
