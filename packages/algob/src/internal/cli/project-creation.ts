import { BuilderError, ERRORS } from "@algo-builder/web";
import chalk from "chalk";
import fsExtra from "fs-extra";
import os from "os";
import path from "path";

import type { PromiseAny } from "../../types";
import { ALGOB_NAME } from "../constants";
import { ExecutionMode, getExecutionMode } from "../core/execution-mode";
import { getPackageJson, getPackageRoot } from "../util/package-info";

const SAMPLE_PROJECT_DEPENDENCIES = ["chai", "mocha"];

const SAMPLE_TS_PROJECT_DEPENDENCIES = [
	...SAMPLE_PROJECT_DEPENDENCIES,
	"@types/mocha",
	"@types/chai",
	"@types/node",
	"typescript",
	"ts-node",
];

export async function printWelcomeMessage(): Promise<void> {
	const packageJson = await getPackageJson();

	console.log(chalk.cyan(`★ Welcome to ${ALGOB_NAME} v${packageJson.version}`));
}

function copy(directory: string, location: string): void {
	fsExtra.copySync(directory, location, {
		// User doesn't choose the directory so overwrite should be avoided
		overwrite: false,
		filter: (_src: string, dest: string) => {
			const relPath = path.relative(process.cwd(), dest);
			if (relPath === "") {
				return true;
			}
			return path.basename(dest) !== ".gitkeep";
		},
	});
}

function copySampleProject(
	location: string,
	isTSProject: boolean,
	withInfrastucture: boolean
): void {
	const packageRoot = getPackageRoot();
	const sampleProjDir = path.join(packageRoot, "sample-project");
	if (fsExtra.pathExistsSync(`./${location}/algob.config.js`)) {
		throw new BuilderError(ERRORS.GENERAL.INIT_INSIDE_PROJECT, {
			clashingFile: location,
		});
	}
	// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
	console.log(
		chalk.greenBright("Initializing new workspace in " + path.join(process.cwd(), location))
	);

	// copy common files first
	copy(path.join(sampleProjDir, "common"), location);

	// copy infrastructure folder depending of --no-infrastructure flag
	if (withInfrastucture) {
		copy(path.join(sampleProjDir, "infrastructure"), path.join(location, "infrastructure"));
	}

	const projectDir = isTSProject
		? path.join(sampleProjDir, "ts")
		: path.join(sampleProjDir, "js");

	// copy JS/TS project files, depending on --typescript flag
	copy(projectDir, location);
}

export function printSuggestedCommands(): void {
	const npx =
		getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION ? "" : "npx ";

	console.log(`Try running some of the following tasks:`);
	console.log(`  ${npx}${ALGOB_NAME} gen-accounts`);
	console.log(`  ${npx}${ALGOB_NAME} compile`);
	console.log(`  ${npx}${ALGOB_NAME} test`);
	console.log(`  ${npx}${ALGOB_NAME} node-info`);
	console.log(`  ${npx}${ALGOB_NAME} deploy`);
	console.log(`  ${npx}${ALGOB_NAME} run`);
	console.log(`  ${npx}${ALGOB_NAME} help`);
	console.log(`  ${npx}${ALGOB_NAME} console`);
}

async function printPluginInstallationInstructions(): Promise<void> {
	console.log(`You need to install these dependencies to run the sample project:`);

	const cmd = await installDevDependenciesCmd();

	console.log(`  ${cmd.join(" ")}`);
}

export async function createProject(
	location: string,
	isTSProject: boolean,
	withInfrastucture: boolean
): PromiseAny {
	await printWelcomeMessage();

	copySampleProject(location, isTSProject, withInfrastucture);

	let shouldShowInstallationInstructions = true;

	const sampleProjectDependencies = isTypeScriptProject()
		? SAMPLE_TS_PROJECT_DEPENDENCIES
		: SAMPLE_PROJECT_DEPENDENCIES;

	if (await canInstallPlugin()) {
		const installedRecommendedDeps = sampleProjectDependencies.filter(isInstalled);

		if (installedRecommendedDeps.length === sampleProjectDependencies.length) {
			shouldShowInstallationInstructions = false;
		} else if (installedRecommendedDeps.length === 0) {
			const shouldInstall = await confirmPluginInstallation();
			if (shouldInstall) {
				const installed = await installRecommendedDependencies();

				if (!installed) {
					console.warn(chalk.red("Failed to install the sample project's dependencies"));
				}

				shouldShowInstallationInstructions = !installed;
			}
		}
	}

	console.log("\n★", chalk.cyan("Project created"), "★\n");

	if (shouldShowInstallationInstructions) {
		await printPluginInstallationInstructions();
		console.log(``);
	}

	printSuggestedCommands();
}

export function createConfirmationPrompt(name: string, message: string) {
	// eslint-disable-line @typescript-eslint/explicit-function-return-type
	return {
		type: "confirm",
		name,
		message,
		initial: "y",
		default: "(Y/n)",
		isTrue(input: string | boolean) {
			if (typeof input === "string") {
				return input.toLowerCase() === "y";
			}

			return input;
		},
		isFalse(input: string | boolean) {
			if (typeof input === "string") {
				return input.toLowerCase() === "n";
			}

			return input;
		},
		format(): string {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			const that = this as any;
			const value = that.value === true ? "y" : "n";

			if (that.state.submitted === true) {
				return that.styles.submitted(value);
			}

			return value;
		},
	};
}

async function canInstallPlugin(): Promise<boolean> {
	return (
		(await fsExtra.pathExists("package.json")) &&
		(getExecutionMode() === ExecutionMode.EXECUTION_MODE_LOCAL_INSTALLATION ||
			getExecutionMode() === ExecutionMode.EXECUTION_MODE_LINKED) &&
		// TODO: Figure out why this doesn't work on Win
		os.type() !== "Windows_NT"
	);
}

function isInstalled(dep: string): boolean {
	const packageJson = fsExtra.readJSONSync("package.json");
	const allDependencies = {
		...packageJson.dependencies,
		...packageJson.devDependencies,
		...packageJson.optionalDependencies,
	};

	return dep in allDependencies;
}

function isYarnProject(): boolean {
	return fsExtra.pathExistsSync("yarn.lock");
}

function isTypeScriptProject(): boolean {
	return fsExtra.pathExistsSync("tsconfig.json");
}

async function installRecommendedDependencies(): Promise<boolean> {
	console.log("");
	const installDevDependCmd = await installDevDependenciesCmd();
	const installDependCmd = await installDependenciesCmd();
	return (
		(await installDependencies(installDevDependCmd[0], installDevDependCmd.slice(1))) &&
		(await installDependencies(installDependCmd[0], installDependCmd.slice(1)))
	);
}

async function confirmPluginInstallation(): Promise<boolean> {
	const { default: enquirer } = await import("enquirer");

	let responses: {
		shouldInstallPlugin: boolean;
	};

	const packageManager = isYarnProject() ? "yarn" : "npm";
	const sampleProjectDependencies = isTypeScriptProject()
		? SAMPLE_TS_PROJECT_DEPENDENCIES
		: SAMPLE_PROJECT_DEPENDENCIES;

	try {
		responses = await enquirer.prompt([
			createConfirmationPrompt(
				"shouldInstallPlugin",
				`Do you want to install the sample project's dependencies with ${packageManager} (${sampleProjectDependencies.join(
					" "
				)})?`
			),
		]);
	} catch (e) {
		if (e === "") {
			return false;
		}

		throw e;
	}

	return responses.shouldInstallPlugin;
}

export async function installDependencies(
	packageManager: string,
	args: string[],
	location?: string
): Promise<boolean> {
	const { spawn } = await import("child_process");

	console.log(`${packageManager} ${args.join(" ")}`);

	const childProcess = spawn(packageManager, args, {
		stdio: "inherit" as any, // eslint-disable-line @typescript-eslint/no-explicit-any,
		cwd: location,
	});

	return await new Promise<boolean>((resolve, reject) => {
		childProcess.once("close", (status) => {
			childProcess.removeAllListeners("error");

			if (status === 0) {
				resolve(true);
				return;
			}

			reject(new Error("script process returned not 0 status"));
		});

		childProcess.once("error", (status) => {
			childProcess.removeAllListeners("close");
			reject(new Error("script process returned not 0 status"));
		});
	});
}

async function installDevDependenciesCmd(): Promise<string[]> {
	const isGlobal = getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION;
	const sampleProjectDependencies = isTypeScriptProject()
		? SAMPLE_TS_PROJECT_DEPENDENCIES
		: SAMPLE_PROJECT_DEPENDENCIES;

	if (isYarnProject()) {
		const cmd = ["yarn"];
		if (isGlobal) {
			cmd.push("global");
		}
		cmd.push("add", "--dev", ...sampleProjectDependencies);
		return cmd;
	}

	const npmInstall = ["npm", "install"];
	if (isGlobal) {
		npmInstall.push("--global");
	}

	return [...npmInstall, "--save-dev", ...sampleProjectDependencies];
}

async function installDependenciesCmd(): Promise<string[]> {
	const isGlobal = getExecutionMode() === ExecutionMode.EXECUTION_MODE_GLOBAL_INSTALLATION;
	const sampleProjectDependencies = ["@algo-builder/web"];

	if (isYarnProject()) {
		const cmd = ["yarn"];
		if (isGlobal) {
			cmd.push("global");
		}
		cmd.push("add", ...sampleProjectDependencies);
		return cmd;
	}

	const npmInstall = ["npm", "install"];
	if (isGlobal) {
		npmInstall.push("--global");
	}

	return [...npmInstall, ...sampleProjectDependencies];
}
