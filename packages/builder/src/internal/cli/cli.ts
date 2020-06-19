
import { getPackageJson, PackageJson } from "../util/package-info";
import { ArgumentsParser } from "./arguments-parser";
import semver from "semver";
import { BuidlerError, BuidlerPluginError } from "../core/errors";
import { ERRORS, getErrorCode } from "./../core/errors-list";
import { BUIDLER_PARAM_DEFINITIONS } from "../core/params/buidler-params";
import { getEnvBuidlerArguments } from "../core/params/env-variables";

async function printVersionMessage(packageJson: PackageJson) {
  console.log(packageJson.version);
}

function ensureValidNodeVersion(packageJson: PackageJson) {
  const requirement = packageJson.engines.node;
  if (!semver.satisfies(process.version, requirement)) {
    throw new BuidlerError(ERRORS.GENERAL.INVALID_NODE_VERSION, {
      requirement,
    });
  }
}

async function main() {
  console.log("Apache was set up correctly!")

  const argumentsParser = new ArgumentsParser();

  const envVariableArguments = getEnvBuidlerArguments(
    BUIDLER_PARAM_DEFINITIONS,
    process.env
  );


  const {
    buidlerArguments,
    taskName: parsedTaskName,
    unparsedCLAs,
  } = argumentsParser.parseBuidlerArguments(
    BUIDLER_PARAM_DEFINITIONS,
    envVariableArguments,
    process.argv.slice(2)
  );

  const packageJson = await getPackageJson()

  // --version is a special case
  if (buidlerArguments.version) {
    await printVersionMessage(packageJson);
    return;
  }

}

main()
  .then(() => process.exit(process.exitCode))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

