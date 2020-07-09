
import util from "util";
import globModule from "glob";

export async function glob(pattern: string, params?: any): Promise<string[]> {
  return util.promisify(globModule)(pattern, params || { realpath: true });
}
