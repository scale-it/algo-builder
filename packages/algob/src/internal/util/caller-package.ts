import findupSync from "findup-sync";
import * as path from "path";

function findClosestPackageJson (file: string): string | null {
  return findupSync("package.json", { cwd: path.dirname(file) }) ?? null;
}

/**
 * Returns the name of the closest package in the callstack that isn't this.
 */
export function getClosestCallerPackage (): string | undefined {
  const previousPrepareStackTrace = Error.prepareStackTrace;

  Error.prepareStackTrace = (e, s) => s;

  const error = new Error();
  const stack: NodeJS.CallSite[] = error.stack as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  Error.prepareStackTrace = previousPrepareStackTrace;

  const currentPackage = findClosestPackageJson(__filename);

  for (const callSite of stack) {
    const fileName = callSite.getFileName();
    if (fileName !== null && path.isAbsolute(fileName)) {
      const callerPackage = findClosestPackageJson(fileName);

      if (callerPackage === currentPackage) {
        continue;
      }

      if (callerPackage === null) {
        return undefined;
      }

      return require(callerPackage).name; // eslint-disable-line @typescript-eslint/no-var-requires
    }
  }

  return undefined;
}
