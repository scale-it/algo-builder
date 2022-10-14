import { compareArray } from "@algo-builder/runtime/src/lib/compare";
import {
	decodeAddress,
	decodeObj,
	decodeSignedTransaction,
	decodeUnsignedTransaction,
} from "algosdk";
import { assert } from "chai";
import * as fs from "fs";
import path from "path";
import sinon from "sinon";

import { TASK_SIGN_MULTISIG } from "../../src/builtin-tasks/task-names";
import { ASSETS_DIR } from "../../src/internal/core/project-structure";
import { loadEncodedTxFromFile } from "../../src/lib/files";
import { HttpNetworkConfig } from "../../src/types";
import { getEnv } from "../helpers/environment";
import { useFixtureProject } from "../helpers/project";
import { account1, bobAcc } from "../mocks/account";

export const netCfg: HttpNetworkConfig = {
	accounts: [account1, bobAcc],
	host: "localhost",
	port: 8080,
	token: "some-fake-token",
};

const [aliceAddr, johnAddr, bobAddr] = [
	"EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
	"2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA",
	"2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ",
];

describe("Sign-Multisig task", function () {
	useFixtureProject("config-project");

	const inputFile = "multisig-signed.txn"; // present in config-project/assets
	const unsignedInputFile = "multisig-unsigned.txn";
	const outFile = "bob-signed.txn";
	const bobPk = decodeAddress(bobAcc.addr).publicKey;
	before(async function () {
		this.env = await getEnv(netCfg); // update this.env with custom netCfg
	});

	afterEach(function () {
		const outPath = path.join(ASSETS_DIR, outFile);
		if (fs.existsSync(outPath)) {
			fs.rmSync(outPath);
		}
	});

	it("Append bob's signature to multisigned txn loaded from file", async function () {
		const encodedTx = loadEncodedTxFromFile(inputFile) as Uint8Array;
		const txMsig = decodeSignedTransaction(encodedTx).msig;

		// input assertions (verfiy bob pk is present in pre-image, but it is not signed,
		// i.e signature is not present)
		assert.isDefined(txMsig);
		assert.deepInclude(txMsig?.subsig, { pk: bobPk } as any); // msig includes bobPk (but without signature i.e "s" field)

		// append bob signature to txn.msig
		await this.env.run(TASK_SIGN_MULTISIG, {
			file: inputFile,
			account: bobAcc.name,
			out: outFile,
		});

		// output assertions
		assert(fs.existsSync(path.join(ASSETS_DIR, outFile))); // outfile exists after commmand

		const outTx = loadEncodedTxFromFile(outFile) as Uint8Array;
		const outTxMsig = decodeSignedTransaction(outTx).msig;

		const bobSubsig = outTxMsig?.subsig.find((s) => compareArray(s.pk, bobPk));
		assert.isDefined(bobSubsig?.pk);
		assert.isDefined(bobSubsig?.s); // bob "signature" should be present
	});

	it("should throw error if account pre-image not present transaction's multisig", async function () {
		const encodedTx = loadEncodedTxFromFile(inputFile) as Uint8Array;
		const txMsig = decodeSignedTransaction(encodedTx).msig;

		// verify encodedTx is not signed by account1's secret key.
		// (by verifying account1 pk not present in msig.subsig)
		const account1Pk = decodeAddress(account1.addr).publicKey;
		assert.isDefined(txMsig);
		assert.notDeepInclude(txMsig?.subsig, { pk: account1Pk } as any);

		try {
			await this.env.run(TASK_SIGN_MULTISIG, {
				file: inputFile,
				account: account1.name,
				out: outFile,
			});
		} catch (error) {
			if (error instanceof Error) {
				assert.equal(error.message, "Key does not exist");
			}
			console.error("An unexpected error occurred:", error);
		}
	});

	it("Should log error if account name is not present in algob config", async function () {
		const stub = console.error as sinon.SinonStub;
		stub.reset();

		await this.env.run(TASK_SIGN_MULTISIG, {
			file: inputFile,
			account: "random-account", // random account name
			out: outFile,
		});

		assert.isTrue(
			stub.calledWith('No account with the name "random-account" exists in the config file.')
		);
		assert.isFalse(fs.existsSync(outFile)); // outfile does not exist
	});

	it("Should log warning if outfile already exists", async function () {
		const stub = console.error as sinon.SinonStub;
		stub.reset();

		// create new out-file (before running task)
		fs.writeFileSync(path.join(ASSETS_DIR, outFile), "algo-builder"); // creating new file

		await this.env.run(TASK_SIGN_MULTISIG, {
			file: inputFile,
			account: "bob",
			out: outFile,
		});

		assert.isTrue(
			stub.calledWith(
				`File assets/${outFile} already exists. Aborting. Use --force flag if you want to overwrite it`
			)
		);
	});

	it("Should append `_out` to input file name if name of outfile is not passed", async function () {
		await this.env.run(TASK_SIGN_MULTISIG, {
			file: inputFile,
			account: "bob",
		});

		const newOutPath = path.join(ASSETS_DIR, "multisig-signed_out.txn");
		assert.isTrue(fs.existsSync(newOutPath)); // outfile path (with appended _out) should exist

		fs.rmSync(newOutPath); // delete out file
	});

	it("Create a new multisigned transaction with bob's signature from raw txn loaded from file", async function () {
		const encodedTx = loadEncodedTxFromFile(unsignedInputFile) as Uint8Array;
		const tx = decodeUnsignedTransaction(encodedTx);

		// input assertion: verify transaction does not have an msig
		assert.isUndefined((tx as any).msig);

		// create new msig with bob signature
		await this.env.run(TASK_SIGN_MULTISIG, {
			file: unsignedInputFile,
			account: bobAcc.name,
			out: outFile,
			v: "1",
			thr: "2",
			addrs: `${aliceAddr},${johnAddr},${bobAddr}`,
		});

		// output assertions
		assert(fs.existsSync(path.join(ASSETS_DIR, outFile))); // outfile exists after commmand
		const outTx = loadEncodedTxFromFile(outFile) as Uint8Array;
		const outTxMsig = decodeSignedTransaction(outTx).msig;

		const bobSubsig = outTxMsig?.subsig.find((s) => compareArray(s.pk, bobPk));
		assert.isDefined(bobSubsig?.pk);
		assert.isDefined(bobSubsig?.s); // bob "signature" should be present
	});

	it("should throw error if creating a new multisigned transaction but multisig metadata is not passed", async function () {
		try {
			await this.env.run(TASK_SIGN_MULTISIG, {
				file: unsignedInputFile,
				account: bobAcc.name,
				out: outFile,
			});
		} catch (error) {
			if (error instanceof Error) {
				assert.equal(
					error.message,
					`Multisig MetaData (version, threshold, addresses) not passed. This is required for creating a new multisig. Aborting`
				);
			}
			console.error("An unexpected error occurred:", error);
		}
	});

	it("should throw error while creating a new multisig tx with account address not part of multisignature hash", async function () {
		const encodedTx = loadEncodedTxFromFile(unsignedInputFile) as Uint8Array;
		const tx = decodeUnsignedTransaction(encodedTx);

		// input assertion: verify transaction does not have an msig
		assert.isUndefined((tx as any).msig);

		try {
			// try to create new msig with signature not present in msig.addrs
			await this.env.run(TASK_SIGN_MULTISIG, {
				file: unsignedInputFile,
				account: account1.name, // not present in metadata.adds
				out: outFile,
				v: "1",
				thr: "2",
				addrs: `${aliceAddr},${johnAddr},${bobAddr}`,
			});
		} catch (error) {
			if (error instanceof Error) {
				assert.equal(error.message, "Key does not exist");
			}
			console.error("An unexpected error occurred:", error);
		}
	});

	it("Append bob's signature to txn group loaded from file", async function () {
		const encodedTxGroup = loadEncodedTxFromFile("multisig-group.tx") as Uint8Array;
		const decodedInputGroup = decodeObj(encodedTxGroup) as Uint8Array[];

		// we will sign 3rd transaction in group here (already signed previously)
		const tx2 = decodeSignedTransaction(decodedInputGroup[2]);
		assert.isDefined(tx2.msig);
		assert.deepInclude(tx2.msig?.subsig, { pk: bobPk } as any); // msig includes bobPk (but without signature i.e "s" field)

		// // append bob signature to txn.msig
		await this.env.run(TASK_SIGN_MULTISIG, {
			file: "multisig-group.tx",
			account: bobAcc.name,
			out: outFile,
			groupIndex: "2", // pass group index
		});

		// output assertions
		assert(fs.existsSync(path.join(ASSETS_DIR, outFile))); // outfile exists after commmand

		const outTxGroup = loadEncodedTxFromFile(outFile) as Uint8Array;
		const decodedOutGroup = decodeObj(outTxGroup) as Uint8Array[];

		// verify first two transactions in group are same (as only 3rd was signed)
		assert.deepEqual(decodedInputGroup[0], decodedOutGroup[0]);
		assert.deepEqual(decodedInputGroup[1], decodedOutGroup[1]);

		// now verify signature (3rd tx in group)
		const outTx3Msig = decodeSignedTransaction(decodedOutGroup[2]).msig;
		const bobSubsig = outTx3Msig?.subsig.find((s) => compareArray(s.pk, bobPk));
		assert.isDefined(bobSubsig?.pk);
		assert.isDefined(bobSubsig?.s); // bob "signature" should be present
	});
});
