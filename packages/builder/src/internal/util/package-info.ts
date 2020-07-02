import findup from "find-up";
import fsExtra from "fs-extra";
import path from "path";

function getPackageJsonPath(): string | null {
  return findClosestPackageJson(__filename);
}

export function getPackageRoot(): string {
  const packageJsonPath = getPackageJsonPath();
  if(packageJsonPath === null)
    throw Error("Can't find package root. File `package.json` doesn't exist in the project.")

  return path.dirname(packageJsonPath);
}

export interface PackageJson {
  name: string;
  version: string;
  engines: {
    node: string;
  };
}

function findClosestPackageJson(file: string): string | null {
  return findup.sync("package.json", { cwd: path.dirname(file) }) || null;
}

export async function getPackageJson(): Promise<PackageJson> {
  const root = await getPackageRoot();
  return fsExtra.readJSON(path.join(root, "package.json"));
}
