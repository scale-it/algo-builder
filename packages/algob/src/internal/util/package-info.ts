import findupSync from "findup-sync";
import { readJSON } from "fs-extra";
import * as path from "path";

function getPackageJsonPath (): string | null {
  return findClosestPackageJson(__filename);
}

export function getPackageRoot (): string {
  const packageJsonPath = getPackageJsonPath();
  if (packageJsonPath === null) { throw Error("Can't find package root. File `package.json` doesn't exist in the project."); }

  return path.dirname(packageJsonPath);
}

export interface PackageJson {
  name: string
  version: string
  engines: {
    node: string
  }
}

function findClosestPackageJson (file: string): string | null {
  return findupSync("package.json", { cwd: path.dirname(file) }) ?? null;
}

export async function getPackageJson (): Promise<PackageJson> {
  const root = getPackageRoot();
  return await readJSON(path.join(root, "package.json"));
}
