import { types } from "@algo-builder/web";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../src/index";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { elonMuskAccount } from "../mocks/account";

describe("Algorand Smart Contracts - Execute transaction", function () {
	useFixture("stateful");
	const initialBalance = BigInt(5e6);
	let john: AccountStore;
	let alice: AccountStore;
	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let approvalProgram: string;
	let clearProgram: string;
	let assetId: number;

	this.beforeEach(() => {
		john = new AccountStore(initialBalance, elonMuskAccount);
		alice = new AccountStore(initialBalance);
		runtime = new Runtime([john, alice]); // setup test

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
});
