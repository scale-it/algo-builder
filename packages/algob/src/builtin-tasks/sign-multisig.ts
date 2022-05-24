import { getPathFromDirRecursive } from "@algo-builder/runtime";
import { decodeObj, encodeObj, MultisigMetadata } from "algosdk";
import path from "path";

import { task } from "../internal/core/config/config-env";
import { ASSETS_DIR } from "../internal/core/project-structure";
import { loadEncodedTxFromFile } from "../lib/files";
import { signMultiSig } from "../lib/msig";
import { RuntimeEnv } from "../types";
import { writeToFile } from "./gen-accounts";
import { TASK_SIGN_MULTISIG } from "./task-names";

export interface TaskArgs {
	file: string;
	account: string;
	out?: string;
	v?: string;
	thr?: string;
	addrs?: string;
	groupIndex?: string;
	force: boolean;
}

async function multiSignTx(taskArgs: TaskArgs, runtimeEnv: RuntimeEnv): Promise<void> {
	const signerAccount = runtimeEnv.network.config.accounts.find(
		(acc) => acc.name === taskArgs.account
	);
	if (signerAccount === undefined) {
		console.error(`No account with the name "${taskArgs.account}" exists in the config file.`);
		return;
	}
	let rawTxn = loadEncodedTxFromFile(taskArgs.file); // single tx OR tx group
	if (rawTxn === undefined) {
		console.error("Error loading transaction from the file.");
		return;
	}

	const groupIndex = Number(taskArgs.groupIndex) ?? 0;
	const decodedTx = decodeObj(rawTxn);
	if (Array.isArray(decodedTx)) {
		rawTxn = decodedTx[groupIndex]; // set "this" tx for signing in case of txgroup
	}

	const sourceFilePath = getPathFromDirRecursive(ASSETS_DIR, taskArgs.file) as string;
	let mparams: MultisigMetadata | undefined;
	const { v, thr, addrs } = taskArgs;
	if (v && thr && addrs) {
		mparams = { version: Number(v), threshold: Number(thr), addrs: addrs.split(",") };
	}
	const signedTxn = signMultiSig(signerAccount, rawTxn as Uint8Array, mparams);

	const [name, ext] = taskArgs.file.split(".");
	const outFileName = taskArgs.out ?? name + "_out." + ext;
	const outFilePath = path.join(path.dirname(sourceFilePath), outFileName);

	let outData;
	if (Array.isArray(decodedTx)) {
		decodedTx[groupIndex] = signedTxn.blob;
		outData = encodeObj(decodedTx);
	} else {
		outData = signedTxn.blob;
	}
	await writeToFile(outData, taskArgs.force, outFilePath);
}

export default function (): void {
	task(TASK_SIGN_MULTISIG, "Signs a transaction object from a file using Multi Signature")
		.addParam(
			"account",
			"Name of the account (present in `algob.config.js`) to be used for signing the transaction."
		)
		.addParam("file", "Name of the transaction file in assets directory")
		.addOptionalParam(
			"out",
			'Name of the file to be used for resultant transaction file.\n\t\tIf not provided source transaction file\'s name will be appended by "_out"\n'
		)
		.addOptionalParam(
			"v",
			"Multisig version (required if creating a new signed multisig transaction)"
		)
		.addOptionalParam(
			"thr",
			"Multisig threshold (required if creating a new signed multisig transaction)"
		)
		.addOptionalParam(
			"addrs",
			"Comma separated addresses comprising of the multsig (addr1,addr2,..). Order is important. \n\t\t(required if creating a new signed multisig transaction)\n"
		)
		.addOptionalParam(
			"groupIndex",
			"Index of transaction (0 indexed) to sign if file has an encoded transaction group. Defaults to 0."
		)
		.addFlag("force", "Overwrite output transaction file if the file already exists.")
		.setAction((input, env) => multiSignTx(input, env));
}
