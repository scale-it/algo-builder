
import globModule from "glob";
import util from "util";

export async function glob(pattern: string, params?: Record<string, unknown>): Promise<string[]> {
  return util.promisify(globModule)(pattern, params || { realpath: true });
}

export async function getSortedScriptsNoGlob(
  directory: string,
  globFn: (pattern: string, params?: Record<string, unknown>) => Promise<string[]>
): Promise<string[]> {
  return (await globFn(directory, {})).sort()
}

export function getSortedScripts(directory: string): Promise<string[]> {
  return getSortedScriptsNoGlob(directory, glob)
}
