import { types } from "@algo-builder/runtime";
import { ERRORS, tx as webTx, types as wtypes } from "@algo-builder/web";
import algosdk, {
	decodeSignedTransaction,
	encodeAddress,
	makeAssetCreateTxn,
	Transaction,
} from "algosdk";
import { assert } from "chai";
import { SinonStub, stub } from "sinon";
import { TextEncoder } from "util";

import { DeployerDeployMode, DeployerRunMode } from "../../src/internal/deployer";
import { DeployerConfig } from "../../src/internal/deployer_cfg";
import { ConfirmedTxInfo, Deployer, TxnReceipt } from "../../src/types";
import { expectBuilderError, expectBuilderErrorAsync } from "../helpers/errors";
import { mkEnv } from "../helpers/params";
import { useFixtureProject, useFixtureProjectCopy } from "../helpers/project";
import { aliceAcc, bobAcc } from "../mocks/account";
import {
	mockAssetInfo,
	mockGenesisInfo,
	mockLsig,
	mockPendingTransactionInformation,
	mockSuggestedParam,
	TXN_OBJ,
} from "../mocks/tx";
import { AlgoOperatorDryRunImpl } from "../stubs/algo-operator";

describe("Note in TxParams", () => {
	const encoder = new TextEncoder();
	const note = "Hello Algob!";
	const noteb64Src = "hello";
	const noteb64 = Buffer.from(noteb64Src).toString("base64");

	it("Both notes given", () => {
		assert.throw(() => {
			webTx.encodeNote(note, noteb64);
		}, "both note and noteb64");
	});

	it("Only note given", () => {
		let result = webTx.encodeNote(note, undefined);
		assert.deepEqual(result, encoder.encode(note), "note not encoded");

		const noteEncoded = encoder.encode(note);
		result = webTx.encodeNote(noteEncoded, undefined);
		assert.deepEqual(result, noteEncoded, "note not encoded");
	});

	it("Only noteb64 given", () => {
		const result = webTx.encodeNote(undefined, noteb64);
		assert.isDefined(result);
		assert.deepEqual(
			Buffer.from(result as Uint8Array).toString(),
			noteb64Src,
			"noteb64 not encoded"
		);
	});
});

function mkASA(): wtypes.ASADef {
	return {
		total: 1,
		decimals: 1,
		unitName: "ASA",
		defaultFrozen: false,
	};
}

function stubAlgodGenesisAndTxParams(algodClient: algosdk.Algodv2): void {
	stub(algodClient, "getTransactionParams").returns({
		do: async () => mockSuggestedParam,
	} as ReturnType<algosdk.Algodv2["getTransactionParams"]>);
	stub(algodClient, "genesis").returns({ do: async () => mockGenesisInfo } as ReturnType<
		algosdk.Algodv2["genesis"]
	>);
}

describe("Opt-In to ASA", () => {
	useFixtureProject("config-project");

	let deployer: Deployer;
	let execParams: wtypes.OptInASAParam;
	let algod: AlgoOperatorDryRunImpl;
	let expected: TxnReceipt[];
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		const deployerCfg = new DeployerConfig(env, algod);
		deployerCfg.asaDefs = { silver: mkASA() };
		deployer = new DeployerDeployMode(deployerCfg);
		await deployer.deployASA("silver", { creator: deployer.accounts[0] });
		execParams = {
			type: wtypes.TransactionType.OptInASA,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			assetID: 1,
		};
		stubAlgodGenesisAndTxParams(algod.algodClient);

		expected = [
			{
				"confirmed-round": 1,
				"asset-index": 1,
				"application-index": 1,
				txn: {
					txn: TXN_OBJ,
				},
				txID: algosdk.Transaction.from_obj_for_encoding(TXN_OBJ).txID(),
			},
		];
	});

	afterEach(() => {
		(algod.algodClient.getTransactionParams as SinonStub).restore();
		(algod.algodClient.genesis as SinonStub).restore();
	});

	it("should opt-in to asa using asset id as number", async () => {
		const res = await deployer.executeTx([execParams]);

		assert.deepEqual(res, expected);
	});

	it("Should fail if asset name is passed but not found in checkpoints", async () => {
		execParams.assetID = "unknown";

		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParams]),
			ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_NOT_DEFINED,
			"unknown"
		);
	});

	it("Should set asset id to asset id of asset name passed", async () => {
		execParams.assetID = "silver";

		const res = await deployer.executeTx([execParams]);

		assert.deepEqual(res, expected);
	});
});

describe("ASA modify fields", () => {
	useFixtureProject("config-project");
	let deployer: Deployer;
	let execParams: wtypes.ModifyAssetParam;
	let algod: AlgoOperatorDryRunImpl;
	let assetFields: wtypes.AssetModFields;
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		const deployerCfg = new DeployerConfig(env, algod);
		deployer = new DeployerDeployMode(deployerCfg);
		assetFields = {
			manager: "",
			clawback: bobAcc.addr,
		};
		execParams = {
			type: wtypes.TransactionType.ModifyAsset,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			assetID: 1,
			fields: assetFields,
		};
		stubAlgodGenesisAndTxParams(algod.algodClient);
	});

	afterEach(async () => {
		(algod.algodClient.getTransactionParams as SinonStub).restore();
		(algod.algodClient.genesis as SinonStub).restore();
	});

	/**
	 * Verifies correct asset fields are sent to network
	 * @param rawTxns rawTxns Signed transactions in Uint8Array
	 */
	function checkTx(rawTxns: Uint8Array | Uint8Array[]): Promise<ConfirmedTxInfo> {
		if (Array.isArray(rawTxns)) {
			// verify here if group tx
		} else {
			const tx: Transaction = decodeSignedTransaction(rawTxns).txn;
			// Verify if fields are set correctly
			assert.isUndefined(tx.assetManager);
			assert.isUndefined(tx.assetReserve);
			assert.equal(encodeAddress(tx.assetFreeze.publicKey), mockAssetInfo.params.freeze);
			assert.equal(encodeAddress(tx.assetClawback.publicKey), assetFields.clawback);
		}
		(algod.sendAndWait as SinonStub).restore();
		return algod.sendAndWait(rawTxns);
	}

	it("Should set fields, freeze is not sent, therefore it should be picked from assetInfo", async () => {
		// Manager should be set to ""(sent as undefined to network)
		// Clawback should be updated
		stub(algod, "sendAndWait").callsFake(checkTx);

		await deployer.executeTx([execParams]);
	});
});

describe("Delete ASA and SSC", () => {
	useFixtureProjectCopy("stateful");
	let deployer: Deployer;
	let algod: AlgoOperatorDryRunImpl;
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		const deployerCfg = new DeployerConfig(env, algod);
		deployerCfg.asaDefs = { silver: mkASA() };
		deployer = new DeployerDeployMode(deployerCfg);
		await deployer.deployASA("silver", { creator: deployer.accounts[0] });
		stubAlgodGenesisAndTxParams(algod.algodClient);
	});

	afterEach(async () => {
		(algod.algodClient.getTransactionParams as SinonStub).restore();
		(algod.algodClient.genesis as SinonStub).restore();
	});

	it("Should delete ASA, and set delete boolean in ASAInfo", async () => {
		const execParams: wtypes.DestroyAssetParam = {
			type: wtypes.TransactionType.DestroyAsset,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			assetID: "silver",
		};
		await deployer.executeTx([execParams]);

		const res = deployer.getASAInfo("silver");
		assert.equal(res.deleted, true);
	});

	it("Should delete ASA If asset index is used, instead of asset name", async () => {
		const execParams: wtypes.DestroyAssetParam = {
			type: wtypes.TransactionType.DestroyAsset,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			assetID: 1,
		};
		await deployer.executeTx([execParams]);

		const res = deployer.getASAInfo("silver");
		assert.equal(res.deleted, true);
	});

	it("Should not fail if ASA is not in checkpoints", async () => {
		const execParams: wtypes.DestroyAssetParam = {
			type: wtypes.TransactionType.DestroyAsset,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			assetID: 2,
		};
		await deployer.executeTx([execParams]);
	});

	it("Should delete SSC, set delete boolean in latest AppInfo", async () => {
		const appDefinition: wtypes.AppDefinitionFromFile = {
			appName: "app",
			metaType: wtypes.MetaType.FILE,
			localBytes: 1,
			localInts: 1,
			globalBytes: 1,
			globalInts: 1,
			approvalProgramFilename: "approval.teal",
			clearProgramFilename: "clear.teal",
		};
		const info = await deployer.deployApp(bobAcc, appDefinition, {});
		const execParams: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.DeleteApp,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			appID: info.appID,
		};

		await deployer.executeTx([execParams]);

		const res = deployer.getApp("app");
		assert.isDefined(res);
		if (res) assert.equal(res.deleted, true);
	});

	it("Should not fail if SSC is not in checkpoints", async () => {
		const execParams: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.DeleteApp,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			appID: 23,
		};
		await deployer.executeTx([execParams]);
	});
});

describe("Delete ASA and SSC transaction flow(with functions and executeTx)", () => {
	useFixtureProject("stateful");
	let deployer: Deployer;
	let algod: AlgoOperatorDryRunImpl;
	let appID: number;
	let assetID: number;
	const assetName = "silver";
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		const deployerCfg = new DeployerConfig(env, algod);
		deployerCfg.asaDefs = { silver: mkASA() };
		deployer = new DeployerDeployMode(deployerCfg);
		stubAlgodGenesisAndTxParams(algod.algodClient);

		// deploy  and delete asset
		const asaInfo = await deployer.deployASA(assetName, { creator: deployer.accounts[0] });
		assetID = asaInfo.assetIndex;
		const execParams: wtypes.DestroyAssetParam = {
			type: wtypes.TransactionType.DestroyAsset,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			assetID: 1,
		};
		await deployer.executeTx([execParams]);

		// deploy and delete app
		const appDefinition: wtypes.AppDefinitionFromFile = {
			appName: "app",
			metaType: wtypes.MetaType.FILE,
			localBytes: 1,
			localInts: 1,
			globalBytes: 1,
			globalInts: 1,
			approvalProgramFilename: "approval.teal",
			clearProgramFilename: "clear.teal",
		};
		const info = await deployer.deployApp(bobAcc, appDefinition, {});
		appID = info.appID;
		const execParam: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.DeleteApp,
			sign: wtypes.SignType.SecretKey,
			payFlags: {},
			fromAccount: bobAcc,
			appID: info.appID,
		};
		await deployer.executeTx([execParam]);
	});

	afterEach(async () => {
		(algod.algodClient.getTransactionParams as SinonStub).restore();
		(algod.algodClient.genesis as SinonStub).restore();
	});

	it("should throw error with opt-in asa functions, if asa exist and deleted", async () => {
		await expectBuilderErrorAsync(
			async () => await deployer.optInAccountToASA(assetName, "acc-name-1", {}),
			ERRORS.GENERAL.ASSET_DELETED
		);

		await expectBuilderErrorAsync(
			async () => await deployer.optInLsigToASA(assetName, mockLsig, {}),
			ERRORS.GENERAL.ASSET_DELETED
		);
	});

	it("should pass with opt-in asa functions, if asa doesn't exist in checkpoint", async () => {
		await deployer.optInAccountToASA("23", "acc-name-1", {});

		await deployer.optInLsigToASA("233212", mockLsig, {});
	});

	it("should throw error with opt-in app functions, if app exist and deleted", async () => {
		await expectBuilderErrorAsync(
			async () => await deployer.optInAccountToApp(bobAcc, appID, {}, {}),
			ERRORS.GENERAL.APP_DELETED
		);

		await expectBuilderErrorAsync(
			async () => await deployer.optInLsigToApp(appID, mockLsig, {}, {}),
			ERRORS.GENERAL.APP_DELETED
		);
	});

	it("should pass with opt-in app functions, if app doesn't exist in checkpoint", async () => {
		await deployer.optInAccountToApp(bobAcc, 122, {}, {});

		await deployer.optInLsigToApp(12223, mockLsig, {}, {});
	});

	it("should throw error with update app function, if app exist and deleted", async () => {
		await expectBuilderErrorAsync(
			async () =>
				await deployer.updateApp(
					"app",
					bobAcc,
					{},
					appID,
					{
						metaType: wtypes.MetaType.FILE,
						approvalProgramFilename: "approval.teal",
						clearProgramFilename: "clear.teal",
					},
					{}
				),
			ERRORS.GENERAL.APP_DELETED
		);
	});

	it("should pass with update app functions, if app doesn't exist in checkpoint", async () => {
		await deployer.updateApp(
			"app",
			bobAcc,
			{},
			123,
			{
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
			},
			{}
		);
	});

	it("should fail if user tries to opt-in through execute tx", async () => {
		const execParam: wtypes.OptInASAParam = {
			type: wtypes.TransactionType.OptInASA,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			assetID: assetID,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.ASSET_DELETED
		);
	});

	it("should fail if user tries to modify through execute tx", async () => {
		const execParam: wtypes.ModifyAssetParam = {
			type: wtypes.TransactionType.ModifyAsset,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			assetID: assetID,
			fields: {},
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.ASSET_DELETED
		);
	});

	it("should fail if user tries to freeze through execute tx", async () => {
		const execParam: wtypes.FreezeAssetParam = {
			type: wtypes.TransactionType.FreezeAsset,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			assetID: assetID,
			freezeTarget: "acc-name-1",
			freezeState: true,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.ASSET_DELETED
		);
	});

	it("should fail if user tries to revoke through execute tx", async () => {
		const execParam: wtypes.RevokeAssetParam = {
			type: wtypes.TransactionType.RevokeAsset,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			assetID: assetID,
			recipient: bobAcc.addr,
			revocationTarget: "target",
			amount: 1000,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.ASSET_DELETED
		);
	});

	it("should fail if user tries to destroy through execute tx", async () => {
		const execParam: wtypes.DestroyAssetParam = {
			type: wtypes.TransactionType.DestroyAsset,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			assetID: assetID,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.ASSET_DELETED
		);
	});

	it("should fail if user tries to transfer asa through execute tx", async () => {
		const execParam: wtypes.AssetTransferParam = {
			type: wtypes.TransactionType.TransferAsset,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			assetID: assetID,
			toAccountAddr: aliceAcc.addr,
			amount: 12,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.ASSET_DELETED
		);
	});

	it("should pass if user tries to opt-out through execute tx", async () => {
		const execParam: wtypes.AssetTransferParam = {
			type: wtypes.TransactionType.TransferAsset,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: { closeRemainderTo: bobAcc.addr },
			assetID: assetID,
			toAccountAddr: aliceAcc.addr,
			amount: 12,
		};
		await deployer.executeTx([execParam]);
	});

	it("should throw error if user tries to delete deleted app", async () => {
		const execParam: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.DeleteApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			appID: appID,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.APP_DELETED
		);
	});

	it("should throw error if user tries to update deleted app", async () => {
		const execParam: wtypes.UpdateAppParam = {
			type: wtypes.TransactionType.UpdateApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			appName: "my-app",
			appID: appID,
			newAppCode: {
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
			},
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.APP_DELETED
		);
	});

	it("should throw error if user tries to call deleted app", async () => {
		const execParam: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.CallApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			appID: appID,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.APP_DELETED
		);
	});

	it("should throw error if user tries to opt-in deleted app", async () => {
		const execParam: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.OptInToApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			appID: appID,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.APP_DELETED
		);
	});

	it("should pass if user tries to opt-out deleted app", async () => {
		const execParam: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.CloseApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			appID: appID,
		};
		await expectBuilderErrorAsync(
			async () => await deployer.executeTx([execParam]),
			ERRORS.GENERAL.APP_DELETED
		);

		const execParams: wtypes.AppCallsParam = {
			type: wtypes.TransactionType.ClearApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			appID: appID,
		};
		await deployer.executeTx([execParams]);
	});

	it("should pass if user tries delete app that doesn't exist in checkpoint", async () => {
		const execParam: wtypes.DestroyAssetParam = {
			type: wtypes.TransactionType.DestroyAsset,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			payFlags: {},
			assetID: 123,
		};

		await deployer.executeTx([execParam]);
	});

	it("should pass if user tries delete (asset + app) that doesn't exist in checkpoint", async () => {
		const txGroup: wtypes.ExecParams[] = [
			{
				type: wtypes.TransactionType.DestroyAsset,
				sign: wtypes.SignType.SecretKey,
				fromAccount: bobAcc,
				payFlags: {},
				assetID: 123,
			},
			{
				type: wtypes.TransactionType.DeleteApp,
				sign: wtypes.SignType.SecretKey,
				fromAccount: bobAcc,
				payFlags: {},
				appID: 12213,
			},
		];

		await deployer.executeTx(txGroup);
	});
});

describe("Deploy, Delete transactions test in run mode", () => {
	useFixtureProject("stateful");
	let deployer: Deployer;
	let algod: AlgoOperatorDryRunImpl;
	let deployerCfg: DeployerConfig;
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		deployerCfg = new DeployerConfig(env, algod);
		deployerCfg.asaDefs = { silver: mkASA() };
		deployer = new DeployerRunMode(deployerCfg);
		stubAlgodGenesisAndTxParams(algod.algodClient);
	});

	afterEach(async () => {
		(algod.algodClient.getTransactionParams as SinonStub).restore();
		(algod.algodClient.genesis as SinonStub).restore();
	});

	it("should deploy asa in run mode", async () => {
		const execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployASA,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			asaName: "silver",
			payFlags: {},
		};

		await deployer.executeTx([execParams]);

		// should not be stored in checkpoint if in run mode
		expectBuilderError(
			() => deployer.getASAInfo("silver"),
			ERRORS.BUILTIN_TASKS.DEPLOYER_ASA_NOT_DEFINED
		);
	});

	it("should deploy application in run mode", async () => {
		const execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appDefinition: {
				appName: "app",
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
			},
			payFlags: {},
		};
		await deployer.executeTx([execParams]);

		// should not be stored in checkpoint if in run mode
		expectBuilderError(() => deployer.getApp("app"), ERRORS.GENERAL.APP_NOT_FOUND_IN_CP);
	});

	it("should deploy application in deploy mode and save info by name", async () => {
		deployer = new DeployerDeployMode(deployerCfg);
		const execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appDefinition: {
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
				appName: "dao-app",
			},
			payFlags: {},
		};
		await deployer.executeTx([execParams]);

		// able to retrieve info by "appName"
		assert.isDefined(deployer.getApp("dao-app"));
	});

	it("should delete application in run mode", async () => {
		deployer = new DeployerDeployMode(deployerCfg);
		let execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appDefinition: {
				appName: "app",
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
			},
			payFlags: {},
		};
		const [appInfo] = await deployer.executeTx([execParams]);

		deployer = new DeployerRunMode(deployerCfg);
		execParams = {
			type: wtypes.TransactionType.DeleteApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appID: appInfo["application-index"],
			payFlags: {},
		};

		await deployer.executeTx([execParams]);

		const res = deployer.getApp("app");
		assert.isDefined(res);
		assert.equal(res?.deleted, false);
	});
});

describe("Update transaction test in run mode", () => {
	useFixtureProject("stateful");
	let deployer: Deployer;
	let algod: AlgoOperatorDryRunImpl;
	let deployerCfg: DeployerConfig;
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		deployerCfg = new DeployerConfig(env, algod);
		deployer = new DeployerRunMode(deployerCfg);
		stubAlgodGenesisAndTxParams(algod.algodClient);
	});

	afterEach(async () => {
		(algod.algodClient.getTransactionParams as SinonStub).restore();
		(algod.algodClient.genesis as SinonStub).restore();
	});

	it("should update in run mode", async () => {
		let execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appDefinition: {
				appName: "app",
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
			},
			payFlags: {},
		};
		const [appInfo] = await deployer.executeTx([execParams]);

		// should not be stored in checkpoint if in run mode
		expectBuilderError(() => deployer.getApp("app"), ERRORS.GENERAL.APP_NOT_FOUND_IN_CP);

		execParams = {
			appName: "app",
			type: wtypes.TransactionType.UpdateApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appID: appInfo["application-index"],
			newAppCode: {
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
			},
			payFlags: {},
		};

		await deployer.executeTx([execParams]);
		// should not be stored in checkpoint if in run mode
		expectBuilderError(() => deployer.getApp("app"), ERRORS.GENERAL.APP_NOT_FOUND_IN_CP);
	});

	it("deploy in deploy mode, update in run mode", async () => {
		deployer = new DeployerDeployMode(deployerCfg);
		let execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appDefinition: {
				appName: "app",
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
			},
			payFlags: {},
		};
		await deployer.executeTx([execParams]);
		const appInfo = deployer.getApp("app");
		assert.isDefined(appInfo);

		deployer = new DeployerRunMode(deployerCfg);
		if (appInfo) {
			execParams = {
				appName: "app",
				type: wtypes.TransactionType.UpdateApp,
				sign: wtypes.SignType.SecretKey,
				fromAccount: bobAcc,
				appID: appInfo.appID,
				newAppCode: {
					metaType: wtypes.MetaType.FILE,
					approvalProgramFilename: "approval.teal",
					clearProgramFilename: "clear.teal",
				},
				payFlags: {},
			};

			await deployer.executeTx([execParams]);
			assert.deepEqual(appInfo, deployer.getApp("app"));
		}
	});

	it("deploy in run mode, update in deploy mode", async () => {
		let execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appDefinition: {
				appName: "app",
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
			},
			payFlags: {},
		};
		const [appInfo] = await deployer.executeTx([execParams]);
		expectBuilderError(() => deployer.getApp("app"), ERRORS.GENERAL.APP_NOT_FOUND_IN_CP);

		deployer = new DeployerDeployMode(deployerCfg);
		execParams = {
			type: wtypes.TransactionType.UpdateApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			appID: appInfo["application-index"],
			newAppCode: {
				metaType: wtypes.MetaType.FILE,
				approvalProgramFilename: "approval.teal",
				clearProgramFilename: "clear.teal",
			},
			appName: "app",
			payFlags: {},
		};

		await deployer.executeTx([execParams]);
		// checkpoint is stored for the update
		assert.isDefined(deployer.getApp("app"));
	});
});

describe("Deploy ASA without asa.yaml", () => {
	useFixtureProject("config-project");

	let deployer: Deployer;
	let algod: AlgoOperatorDryRunImpl;
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		const deployerCfg = new DeployerConfig(env, algod);
		deployerCfg.asaDefs = { silver: mkASA() };
		deployer = new DeployerDeployMode(deployerCfg);
		stubAlgodGenesisAndTxParams(algod.algodClient);
	});

	afterEach(async () => {
		(algod.algodClient.getTransactionParams as SinonStub).restore();
		(algod.algodClient.genesis as SinonStub).restore();
	});

	it("should deploy asa without asa.yaml", async () => {
		const exp = {
			total: 10000,
			decimals: 0,
			defaultFrozen: false,
			unitName: "SLV",
			url: "url",
			metadataHash: "12312442142141241244444411111133",
			note: "note",
		};
		const execParams: wtypes.ExecParams = {
			type: wtypes.TransactionType.DeployASA,
			sign: wtypes.SignType.SecretKey,
			fromAccount: bobAcc,
			asaName: "silver-1",
			asaDef: exp,
			payFlags: {},
		};

		await deployer.executeTx([execParams]);

		const res = deployer.getASAInfo("silver-1");
		assert.isDefined(res);
		assert.deepEqual(res.assetDef, exp);
	});
});

describe("SDK Transaction object", () => {
	useFixtureProject("config-project");

	let deployer: Deployer;
	let algod: AlgoOperatorDryRunImpl;
	beforeEach(async () => {
		const env = mkEnv("network1");
		algod = new AlgoOperatorDryRunImpl();
		const deployerCfg = new DeployerConfig(env, algod);
		deployer = new DeployerDeployMode(deployerCfg);
		stubAlgodGenesisAndTxParams(algod.algodClient);
	});

	it("should sign and send transaction", async () => {
		const tx = makeAssetCreateTxn(
			bobAcc.addr,
			mockSuggestedParam.fee,
			mockSuggestedParam.firstRound,
			mockSuggestedParam.lastRound,
			undefined,
			mockSuggestedParam.genesisHash,
			mockSuggestedParam.genesisID,
			1e6,
			0,
			false,
			undefined,
			undefined,
			undefined,
			undefined,
			"UM",
			"ASM",
			undefined
		);
		const transaction: wtypes.TransactionAndSign = {
			transaction: tx,
			sign: { sign: wtypes.SignType.SecretKey, fromAccount: bobAcc },
		};

		const res = await deployer.executeTx([transaction]);
		assert.isDefined(res);
		assert.equal(res[0]["confirmed-round"], 1);
		assert.equal(res[0]["asset-index"], 1);
	});
});
