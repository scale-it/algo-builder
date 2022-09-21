import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { elonMuskAccount } from "../mocks/account";
import * as testdata from "../helpers/data";
import { BaseTxReceipt } from "../../src/types";

describe("Algorand Smart Contracts - Execute transaction", function () {
	useFixture("stateful");
	const initialBalance = BigInt(5e6);
	const vKey = testdata.key1;
	const sKey = testdata.key2;
	let john: AccountStore;
	let alice: AccountStore;
	let elonMusk: AccountStore;
	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let assetId: number;

	this.beforeEach(() => {
		john = new AccountStore(initialBalance, elonMuskAccount);
		alice = new AccountStore(initialBalance);
		elonMusk = new AccountStore(initialBalance);
		runtime = new Runtime([john, alice, elonMusk]); // setup test

		approvalProgramFilename = "counter-approval.teal";
		clearProgramFilename = "clear.teal";
	});

	function syncAccounts(): void {
		john = runtime.getAccount(john.address);
		alice = runtime.getAccount(alice.address);
	}

	function setupAsset(): void {
		// create asset
		assetId = runtime.deployASA("gold", {
			creator: { ...john.account, name: "john" },
		}).assetIndex;
	}

	function setupApp(): void {
		// deploy new app
		runtime.deployApp(
			john.account,
			{
				appName: "app",
				metaType: types.MetaType.FILE,
				approvalProgramFilename,
				clearProgramFilename,
				globalBytes: 32,
				globalInts: 32,
				localBytes: 8,
				localInts: 8,
			},
			{}
		);
	}

	it("should fund account (Transfer txn only), throught execute transaction", function () {
		const txn: types.ExecParams[] = [{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			toAccountAddr: alice.address,
			amountMicroAlgos: 100,
			payFlags: { totalFee: 1000 },
		}];

		runtime.executeTx(txn);

		// check initial balance
		syncAccounts();
		assert.equal(john.balance(), initialBalance - 1100n);
		assert.equal(alice.balance(), initialBalance + 100n);
	});

	it("should execute group of (payment + asset creation) successfully", () => {
		const txGroup: types.ExecParams[] = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				toAccountAddr: alice.address,
				amountMicroAlgos: 100,
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployASA,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				asaName: "gold",
				payFlags: { totalFee: 1000 },
			},
		];
		runtime.executeTx(txGroup);

		syncAccounts();
		assert.equal(john.balance(), initialBalance - 2100n);
		assert.equal(alice.balance(), initialBalance + 100n);
	});

	it("should fail execution group (payment + asset creation), if asset def is not found", () => {
		const txGroup: types.ExecParams[] = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				toAccountAddr: alice.address,
				amountMicroAlgos: 100,
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployASA,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				asaName: "doge",
				payFlags: { totalFee: 1000 },
			},
		];
		const initialJohnAssets = john.getAssetHolding(assetId)?.amount;
		assert.isUndefined(initialJohnAssets);
		assert.throws(() => {
			runtime.executeTx(txGroup);
		}, "ABLDR17");

		// should not update algo balance
		syncAccounts();
		assert.equal(john.balance(), initialBalance);
		assert.equal(alice.balance(), initialBalance);
	});

	it("Should opt-in to asset, through execute transaction", () => {
		setupAsset();
		syncAccounts();
		const assetInfo = runtime.getAssetInfoFromName("gold");
		assert.isDefined(assetInfo);
		let tx: types.ExecParams[];
		if (assetInfo !== undefined) {
			tx = [
				{
					type: types.TransactionType.OptInASA,
					sign: types.SignType.SecretKey,
					fromAccount: alice.account,
					assetID: assetInfo.assetIndex,
					payFlags: { totalFee: 1000 },
				},
			];

			runtime.executeTx(tx);
		}
	});

	it("should execute group of (payment + app creation) successfully", () => {
		const txGroup: types.ExecParams[] = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				toAccountAddr: alice.address,
				amountMicroAlgos: 100,
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: {
					appName: "app",
					metaType: types.MetaType.FILE,
					approvalProgramFilename,
					clearProgramFilename,
					localInts: 1,
					localBytes: 1,
					globalInts: 1,
					globalBytes: 1,
				},
				payFlags: { totalFee: 1000 },
			},
		];
		runtime.executeTx(txGroup);

		syncAccounts();
		assert.equal(john.balance(), initialBalance - 2100n);
		assert.equal(alice.balance(), initialBalance + 100n);
	});

	it("should fail execution group (payment + asset creation), if not enough balance", () => {
		const txGroup: types.ExecParams[] = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				toAccountAddr: alice.address,
				amountMicroAlgos: 1e9,
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.DeployApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appDefinition: {
					appName: "app",
					metaType: types.MetaType.FILE,
					approvalProgramFilename,
					clearProgramFilename,
					localInts: 1,
					localBytes: 1,
					globalInts: 1,
					globalBytes: 1,
				},
				payFlags: {},
			},
		];

		expectRuntimeError(
			() => runtime.executeTx(txGroup),
			RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
		);

		// verify app doesn't exist in map
		const res = runtime.getAppInfoFromName(approvalProgramFilename, clearProgramFilename);
		assert.isUndefined(res);
	});

	it("Should opt-in to app, through execute transaction", () => {
		setupApp();
		syncAccounts();
		const appInfo = runtime.getAppInfoFromName(approvalProgramFilename, clearProgramFilename);
		assert.isDefined(appInfo);
		let tx: types.ExecParams[];
		if (appInfo !== undefined) {
			tx = [
				{
					type: types.TransactionType.OptInToApp,
					sign: types.SignType.SecretKey,
					fromAccount: alice.account,
					appID: appInfo?.appID,
					payFlags: { totalFee: 1000 },
				},
			];

			runtime.executeTx(tx);
		}
	});

	it("Should opt-in and call app, through execute transaction", () => {
		setupApp();
		syncAccounts();

		const appInfo = runtime.getAppInfoFromName(approvalProgramFilename, clearProgramFilename);
		assert.isDefined(appInfo);
		let tx: types.ExecParams[];
		if (appInfo !== undefined) {
			tx = [
				{
					type: types.TransactionType.OptInToApp,
					sign: types.SignType.SecretKey,
					fromAccount: alice.account,
					appID: appInfo?.appID,
					payFlags: { totalFee: 1000 },
				},
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: alice.account,
					appID: appInfo?.appID,
					payFlags: { totalFee: 1000 },
				},
			];

			runtime.executeTx(tx);
		}

		syncAccounts();
		assert.equal(alice.balance(), initialBalance - 2000n);
	});

	it("Should opt-in ASA and transfer asset, through execute transaction", () => {
		setupAsset();

		let tx: types.ExecParams[];
		tx = [
			{
				type: types.TransactionType.OptInASA,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				assetID: assetId,
				payFlags: { totalFee: 100 },
			},
			{
				type: types.TransactionType.TransferAsset,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				toAccountAddr: john.address,
				amount: 0n,
				assetID: assetId,
				payFlags: { totalFee: 2000 },
			},
		];

		runtime.executeTx(tx);

		syncAccounts();
		assert.equal(alice.balance(), initialBalance - 2100n);
		assert.equal(john.balance(), initialBalance);

	});

	it("Should do key registration, through execute transaction", () => {
		const txSKParams: types.KeyRegistrationParam = {
			type: types.TransactionType.KeyRegistration, // payment
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			voteKey: vKey,
			selectionKey: sKey,
			voteFirst: 43,
			voteLast: 1000,
			voteKeyDilution: 5,
			payFlags: { totalFee: 1000 },
		};
		const r = runtime.executeTx([txSKParams])[0] as BaseTxReceipt;
		assert.isDefined(r);
		assert.isDefined(r.txn);
		assert.isDefined(r.txID);
		syncAccounts();
	});

	it("Should modify asset, through execute transaction", () => {
		setupAsset();
		let modFields: types.AssetModFields = {
			manager: elonMusk.address,
			reserve: elonMusk.address,
			clawback: alice.address,
			freeze: alice.address,
		};
		const modifyParam: types.ModifyAssetParam = {
			type: types.TransactionType.ModifyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			assetID: assetId,
			fields: modFields,
			payFlags: {},
		};
		runtime.executeTx([modifyParam]);
		const res = runtime.getAssetDef(assetId);
		assert.equal(res.manager, elonMusk.address);
		assert.equal(res.reserve, elonMusk.address);
		assert.equal(res.clawback, alice.address);
		assert.equal(res.freeze, alice.address);
	});

	it("should freeze asset, through execute transaction", () => {
		setupAsset();
		runtime.optInToASA(assetId, alice.address, {});
		const freezeParam: types.FreezeAssetParam = {
			type: types.TransactionType.FreezeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			assetID: assetId,
			freezeTarget: alice.address,
			freezeState: true,
			payFlags: {},
		};
		runtime.executeTx([freezeParam]);

		const aliceAssetHolding = runtime.getAssetHolding(assetId, alice.address);
		assert.equal(aliceAssetHolding["is-frozen"], true);
	});

	it("should revoke asset, through execute transaction", () => {
		setupAsset();
		runtime.optInToASA(assetId, alice.address, {});

		const revokeParam: types.RevokeAssetParam = {
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			recipient: john.address,
			assetID: assetId,
			revocationTarget: alice.address,
			amount: 0n,
			payFlags: { totalFee: 1000 },
		};
		runtime.executeTx([revokeParam]);

		syncAccounts();
		assert.equal(john.balance(), initialBalance - 1000n);
	});

	it("Should destroy asset, through execute transaction", () => {
		setupAsset();
		const destroyParam: types.DestroyAssetParam = {
			type: types.TransactionType.DestroyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			assetID: assetId,
			payFlags: { totalFee: 1000 },
		};

		runtime.executeTx([destroyParam]);

		syncAccounts();
		assert.equal(john.balance(), initialBalance - 1000n);
	});

	it("Should clear app, through execute transaction", () => {
		setupApp();
		syncAccounts();
		const appInfo = runtime.getAppInfoFromName(approvalProgramFilename, clearProgramFilename);
		assert.isDefined(appInfo);
		let tx: types.AppCallsParam;
		if (appInfo !== undefined) {
			runtime.optInToApp(john.address, appInfo.appID, {}, {});
			tx = {
				type: types.TransactionType.ClearApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account, // sending txn sender other than creator (john), so txn should be rejected
				appID: appInfo.appID,
				payFlags: {},
			};
			runtime.executeTx([tx]);
		}
	});

	it("Should close app, through execute transaction", () => {
		setupApp();
		syncAccounts();
		const appInfo = runtime.getAppInfoFromName(approvalProgramFilename, clearProgramFilename);
		assert.isDefined(appInfo);
		let tx: types.AppCallsParam;
		if (appInfo !== undefined) {
			runtime.optInToApp(john.address, appInfo.appID, {}, {});
			tx = {
				type: types.TransactionType.CloseApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appInfo.appID,
				payFlags: {},
			};
			runtime.executeTx([tx]);
		}
	});

	it("Should delete app, through execute transaction", () => {
		setupApp();
		syncAccounts();
		const appInfo = runtime.getAppInfoFromName(approvalProgramFilename, clearProgramFilename);
		assert.isDefined(appInfo);
		let tx: types.AppCallsParam;
		if (appInfo !== undefined) {
			runtime.optInToApp(john.address, appInfo.appID, {}, {});
			tx = {
				type: types.TransactionType.DeleteApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appInfo.appID,
				payFlags: {},
			};
			runtime.executeTx([tx]);
		}
	});

	it("Should update app, through execute transaction", () => {
		setupApp();
		syncAccounts();
		const appInfo = runtime.getAppInfoFromName(approvalProgramFilename, clearProgramFilename);
		assert.isDefined(appInfo);
		let tx: types.ExecParams;
		if (appInfo !== undefined) {
			runtime.optInToApp(john.address, appInfo.appID, {}, {});
			tx = {
				type: types.TransactionType.UpdateApp,
				sign: types.SignType.SecretKey,
				fromAccount: john.account,
				appID: appInfo.appID,
				newAppCode: {
					metaType: types.MetaType.FILE,
					approvalProgramFilename: approvalProgramFilename,
					clearProgramFilename: clearProgramFilename,
				},
				appName: "app",
				payFlags: {},
			};
			runtime.executeTx([tx]);
		}
	});
});