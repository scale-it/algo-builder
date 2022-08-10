import { parsing, types } from "@algo-builder/web";
import { assert } from "chai";
import cloneDeep from "lodash.clonedeep";
import { encodeBase64 } from "tweetnacl-ts";

import { AccountStore } from "../../../src";
import { encTxToExecParams } from "../../../src/lib/txn";
import { Runtime } from "../../../src/runtime";
import { AccountStoreI, EncTx } from "../../../src/types";
import * as testdata from "../../helpers/data";
import { useFixture } from "../../helpers/integration";

describe("Convert encoded Txn to ExecParams", function () {
	let john: AccountStoreI;
	let smith: AccountStoreI;

	let runtime: Runtime;
	let execParams: types.ExecParams;
	this.beforeEach(() => {
		john = new AccountStore(1e9);
		smith = new AccountStore(1e9);

		runtime = new Runtime([john, smith]);
	});

	// helper - help convert and check param from EncTx to ExecParams
	function assertEncTxConvertedToExecParam(
		runtime: Runtime,
		execParams: types.ExecParams
	): void {
		const sign = {
			sign: types.SignType.SecretKey,
			fromAccount: execParams.fromAccount,
		};

		const cloneExecParams = cloneDeep(execParams);

		if (cloneExecParams.type === types.TransactionType.DeployApp) {
			cloneExecParams.appDefinition = {
				...cloneExecParams.appDefinition,
				metaType: types.MetaType.BYTES,
				approvalProgramBytes: new Uint8Array(32),
				clearProgramBytes: new Uint8Array(32),
				appName: "Mock",
			};
		}
		// add approvalProgram and clearProgram to encTx
		// TODO: recheck it
		const [transaction] = runtime.createTxnContext([cloneExecParams]);
		const encTx = transaction.txn.get_obj_for_encoding() as EncTx;
		encTx.txID = transaction.txn.txID();

		if (execParams.type === types.TransactionType.DeployApp) {
			encTx.metaType = execParams.appDefinition.metaType;
			if (execParams.appDefinition.metaType === types.MetaType.FILE) {
				encTx.approvalProgram = execParams.appDefinition.approvalProgramFilename;
				encTx.clearProgram = execParams.appDefinition.clearProgramFilename;
			}
		}

		// convert appArgs to buffer for an easier comparison
		if (execParams.type === types.TransactionType.CallApp) {
			execParams.appArgs = parsing.parseAppArgs(execParams.appArgs);
		}
		assert.deepEqual(encTxToExecParams(encTx, sign as types.Sign, runtime.ctx), execParams);
	}

	describe("Case pay transaction types", function () {
		it("Should convert SDK Payment Txn(pay) to ExecParams(TransferAlgo)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.TransferAlgo,
				fromAccountAddr: john.address,
				toAccountAddr: smith.address,
				amountMicroAlgos: 1000n,
				payFlags: {
					totalFee: 1000,
					closeRemainderTo: smith.address,
					rekeyTo: smith.address,
				},
			};

			assertEncTxConvertedToExecParam(runtime, execParams);
		});
	});

	describe("Case acfg,axfer,afrz transaction types", function () {
		useFixture("asa-check");
		it("Should convert SDK Deploy ASA Txn to ExecParams(DeployASA)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployASA,
				asaName: "gold",
				payFlags: { totalFee: 1000 },
			};

			execParams.asaDef = runtime.loadedAssetsDefs[execParams.asaName];

			assertEncTxConvertedToExecParam(runtime, execParams);
		});

		it("Should convert SDK FreezeAsset ASA Txn to ExecParams(FreezeAsset)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.FreezeAsset,
				payFlags: {
					totalFee: 1000,
				},
				assetID: 7,
				freezeTarget: smith.address,
				freezeState: true,
			};
			assertEncTxConvertedToExecParam(runtime, execParams);
		});

		it("Should convert SDK Transfer ASA Txn to ExecParams(TransferAsset)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.TransferAsset,
				toAccountAddr: smith.address,
				amount: 10n,
				assetID: 10,
				payFlags: {
					totalFee: 1000,
				},
			};

			assertEncTxConvertedToExecParam(runtime, execParams);
		});

		it("Should convert SDK Destroy ASA Txn to ExecParams(DestroyAsset)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DestroyAsset,
				assetID: 10,
				payFlags: {
					totalFee: 1000,
				},
			};

			assertEncTxConvertedToExecParam(runtime, execParams);
		});

		it("Should convert SDK Modify ASA Txn to ExecParams(ModifyAsset)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.ModifyAsset,
				assetID: 10,
				fields: {
					clawback: smith.address,
					freeze: smith.address,
					manager: john.address,
					reserve: smith.address,
				},
				payFlags: {
					totalFee: 1000,
				},
			};

			assertEncTxConvertedToExecParam(runtime, execParams);
		});
	});

	describe("Case keyreg transaction type", function () {
		it("should convert SDK Keyreg Txn to ExecParams(KeyRegistration)", () => {
			execParams = {
				type: types.TransactionType.KeyRegistration, // payment
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				voteKey: encodeBase64(testdata.key1),
				selectionKey: encodeBase64(testdata.key2),
				voteFirst: 43,
				voteLast: 1000,
				voteKeyDilution: 5,
				payFlags: { totalFee: 1000 },
			};

			assertEncTxConvertedToExecParam(runtime, execParams);
		});
	});

	describe("Case appl transaction type", function () {
		useFixture("stateful");
		it("should convert SDK Deploy Application Txn to ExecParams(DeployApp)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.DeployApp,
				appDefinition: {
					appName: "Mock",
					metaType: types.MetaType.FILE,
					approvalProgramFilename: "counter-approval.teal",
					clearProgramFilename: "clear.teal",
					globalBytes: 1,
					globalInts: 1,
					localBytes: 1,
					localInts: 1,
				},
				payFlags: {
					totalFee: 1000,
				},
			};

			assertEncTxConvertedToExecParam(runtime, execParams);
		});

		it("should convert SDK NoOpt Txn to ExecParams(CallApp)", () => {
			execParams = {
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				type: types.TransactionType.CallApp,
				appID: 42,
				appArgs: ["str:hello", "int:42"],
				payFlags: {
					totalFee: 1000,
				},
			};

			assertEncTxConvertedToExecParam(runtime, execParams);
		});
	});
});
