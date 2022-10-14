import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { AccountStore, Runtime } from "../../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE, ASSET_CREATION_FEE } from "../../../src/lib/constants";
import { AccountStoreI } from "../../../src/types";
import { useFixture } from "../../helpers/integration";

describe("Algorand Smart Contracts(TEALv5) - Inner Transactions[Asset Transfer, Asset Freeze..]", function () {
	useFixture("inner-transaction");
	const fee = 1000;
	const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 50 + fee;
	const master = new AccountStore(300e6);
	let john = new AccountStore(minBalance + fee);
	let elon = new AccountStore(minBalance + fee);
	let bob = new AccountStore(minBalance + fee);
	const charlie = new AccountStore(minBalance + fee); // random account - not exist in runtime env.
	let appAccount: AccountStoreI; // initialized later
	const strAsa = "str:freeze_asa";

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let appDefinition: types.AppDefinitionFromFile;
	let appID: number;
	let assetID: number;
	let appCallParams: types.ExecParams;
	this.beforeAll(function () {
		runtime = new Runtime([master, john, elon, bob]); // setup test
		approvalProgramFilename = "approval-asset-tx.py";
		clearProgramFilename = "clear.teal";

		appDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			globalBytes: 1,
			globalInts: 1,
			localBytes: 1,
			localInts: 1,
		};
	});

	this.beforeEach(function () {
		// reset app (delete + create)
		john.createdApps.delete(appID);
		appDefinition.appName = "app" + Date.now();
		appID = runtime.deployApp(john.account, appDefinition, {}).appID;
		appAccount = runtime.getAccount(getApplicationAddress(appID)); // update app account

		// create asset
		assetID = runtime.deployASA("gold", {
			creator: { ...john.account, name: "john" },
		}).assetIndex;

		// fund app (escrow belonging to app) with 10 ALGO
		const fundAppParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: master.account,
			toAccountAddr: getApplicationAddress(appID),
			amountMicroAlgos: 10e6,
			payFlags: { totalFee: 1000 },
		};

		runtime.executeTx([fundAppParams]);
		syncAccounts();

		appCallParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			appID: appID,
			payFlags: { totalFee: 1000 },
		};
	});

	function syncAccounts(): void {
		appAccount = runtime.getAccount(getApplicationAddress(appID));
		john = runtime.getAccount(john.address);
		elon = runtime.getAccount(elon.address);
		bob = runtime.getAccount(bob.address);
	}

	function optInToASAbyApp(): void {
		const optInParams = {
			...appCallParams,
			appArgs: ["str:opt_in_to_asa"],
			foreignAssets: [assetID],
		};
		runtime.executeTx([optInParams]);
		syncAccounts();

		// transfer some ASA to app
		const asaTransferParam: types.ExecParams = {
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			toAccountAddr: appAccount.address,
			amount: 10,
			assetID: assetID,
			payFlags: { totalFee: 1000 },
		};
		runtime.executeTx([asaTransferParam]);
		syncAccounts();

		runtime.optInToASA(assetID, elon.address, {});
		syncAccounts();
	}

	it("should optin to ASA (by app account)", function () {
		const appHoldingBefore = appAccount.getAssetHolding(assetID);
		assert.isUndefined(appHoldingBefore);

		// optin by app to assetID
		optInToASAbyApp();

		// verify optin
		assert.isDefined(appAccount.getAssetHolding(assetID));
	});

	it("fail on ASA transfer by App if app not optedin to ASA", function () {
		// contracts sends 1 ASA to sender, and 2 ASA to txn.accounts[1]
		const transferASAbyAppParam = {
			...appCallParams,
			appArgs: ["str:transfer_asa"],
			accounts: [elon.address],
			foreignAssets: [assetID],
		};
		assert.throws(
			() => runtime.executeTx([transferASAbyAppParam]),
			`RUNTIME_ERR1404: Account ${appAccount.address} doesn't hold asset index ${assetID}`
		);
	});

	it("initiate ASA transfer from smart contract", function () {
		optInToASAbyApp();
		const appHoldingBefore = appAccount.getAssetHolding(assetID)?.amount;
		const johnHoldingBefore = john.getAssetHolding(assetID)?.amount;
		const elonHoldingBefore = elon.getAssetHolding(assetID)?.amount;

		// contracts sends 1 ASA to sender, and 2 ASA to txn.accounts[1]
		const transferASAbyAppParam = {
			...appCallParams,
			appArgs: ["str:transfer_asa"],
			accounts: [elon.address],
			foreignAssets: [assetID],
		};
		runtime.executeTx([transferASAbyAppParam]);
		syncAccounts();

		// verify ASA transfer
		if (appHoldingBefore && johnHoldingBefore && elonHoldingBefore) {
			assert.equal(appAccount.getAssetHolding(assetID)?.amount, appHoldingBefore - 3n);
			assert.equal(john.getAssetHolding(assetID)?.amount, johnHoldingBefore + 1n);
			assert.equal(elon.getAssetHolding(assetID)?.amount, elonHoldingBefore + 2n);
		}
	});

	it("empty app's account ASA holding to txn.accounts[1] if close remainder to is passed", function () {
		optInToASAbyApp();
		const appHoldingBefore = appAccount.getAssetHolding(assetID)?.amount;
		const elonHoldingBefore = elon.getAssetHolding(assetID)?.amount;
		assert.isDefined(appHoldingBefore);

		// empties contract's ALGO's to elon (after deducting fees)
		const txParams = {
			...appCallParams,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:transfer_asa_with_close_rem_to"],
			accounts: [elon.address],
			foreignAssets: [assetID],
		};
		runtime.executeTx([txParams]);
		syncAccounts();

		// verify app holding removed and all ASA transferred to elon
		assert.isUndefined(appAccount.getAssetHolding(assetID));
		if (elonHoldingBefore && appHoldingBefore) {
			assert.equal(elon.getAssetHolding(assetID)?.amount, elonHoldingBefore + appHoldingBefore);
		}
	});

	it("should fail on asset clawback if clawback !== application account", function () {
		optInToASAbyApp();
		// empties contract's ALGO's to elon (after deducting fees)
		const txParams = {
			...appCallParams,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:asa_clawback_from_txn1_to_txn2"],
			accounts: [john.address, elon.address], // clawback 2 ASA from john -> elon by App
			foreignAssets: [assetID],
		};
		assert.throws(
			() => runtime.executeTx([txParams]),
			`RUNTIME_ERR1506: Only Clawback account WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY can revoke asset`
		);
	});

	it("should clawback 2 ASA by application account from Txn.accounts[1] to Txn.accounts[2]", function () {
		optInToASAbyApp();
		const johnHoldingBefore = john.getAssetHolding(assetID)?.amount;
		const elonHoldingBefore = elon.getAssetHolding(assetID)?.amount;

		// update clawback to app account
		const asaDef = john.createdAssets.get(assetID);
		if (asaDef) asaDef.clawback = appAccount.address;

		// empties contract's ALGO's to elon (after deducting fees)
		const txParams = {
			...appCallParams,
			appArgs: ["str:asa_clawback_from_txn1_to_txn2"],
			accounts: [john.address, elon.address], // clawback 2 ASA from john -> elon by App
			foreignAssets: [assetID],
		};

		runtime.executeTx([txParams]);
		syncAccounts();

		// verify 2 ASA are clawbacked from john -> elon
		if (johnHoldingBefore && elonHoldingBefore) {
			assert.equal(john.getAssetHolding(assetID)?.amount, johnHoldingBefore - 2n);
			assert.equal(elon.getAssetHolding(assetID)?.amount, elonHoldingBefore + 2n);
		}
	});

	it("should fail on asset freeze if asset freeze !== application account", function () {
		const txParams = {
			...appCallParams,
			appArgs: [strAsa],
			accounts: [john.address],
			foreignAssets: [assetID],
		};

		assert.throws(
			() => runtime.executeTx([txParams]),
			`RUNTIME_ERR1505: Only Freeze account WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY can freeze asset`
		);
	});

	it("should fail if txn.accounts[1] not optedIn to ASA", function () {
		// update freeze to app account
		const asaDef = john.createdAssets.get(assetID);
		if (asaDef) asaDef.freeze = appAccount.address;

		const txParams = {
			...appCallParams,
			appArgs: [strAsa],
			accounts: [elon.address], // elon is not optedin
			foreignAssets: [assetID],
		};

		assert.throws(
			() => runtime.executeTx([txParams]),
			`RUNTIME_ERR1404: Account ${elon.address} doesn't hold asset index ${assetID}`
		);
	});

	it("should freeze asset (by app account)", function () {
		// update freeze to app account
		const asaDef = john.createdAssets.get(assetID);
		if (asaDef) asaDef.freeze = appAccount.address;

		// not frozen
		assert.equal(john.getAssetHolding(assetID)?.["is-frozen"], false);

		const txParams = {
			...appCallParams,
			appArgs: [strAsa],
			accounts: [john.address],
			foreignAssets: [assetID],
		};
		runtime.executeTx([txParams]);
		syncAccounts();

		// frozen
		assert.equal(john.getAssetHolding(assetID)?.["is-frozen"], true);
	});

	it("should unfreeze asset (by app account)", function () {
		// update freeze to app account
		const asaDef = john.createdAssets.get(assetID);
		if (asaDef) asaDef.freeze = appAccount.address;

		// set frozen == true
		const johnAssetHolding = john.getAssetHolding(assetID);
		if (johnAssetHolding) johnAssetHolding["is-frozen"] = true;

		const txParams = {
			...appCallParams,
			appArgs: ["str:unfreeze_asa"],
			accounts: [john.address],
			foreignAssets: [assetID],
		};
		runtime.executeTx([txParams]);
		syncAccounts();

		// verify unfrozen
		assert.equal(john.getAssetHolding(assetID)?.["is-frozen"], false);
	});

	it("should fail on asset delete if asset manager !== application account", function () {
		const txParams = {
			...appCallParams,
			appArgs: ["str:delete_asa"],
			foreignAssets: [assetID],
		};

		assert.throws(
			() => runtime.executeTx([txParams]),
			`RUNTIME_ERR1504: Only Manager account WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY can modify or destroy asset`
		);
	});

	it("should delete asset (by app account)", function () {
		// update asset manager to app account
		const asaDef = john.createdAssets.get(assetID);
		if (asaDef) asaDef.manager = appAccount.address;

		// assert ASA defined
		assert.isDefined(runtime.getAssetDef(assetID));

		const txParams = {
			...appCallParams,
			appArgs: ["str:delete_asa"],
			foreignAssets: [assetID],
		};
		runtime.executeTx([txParams]);
		syncAccounts();

		// assert ASA deleted
		assert.throws(
			() => runtime.getAssetDef(assetID),
			`RUNTIME_ERR1502: Asset with Index ${assetID} not found`
		);
	});

	it("should fail on asset modification if asset manager !== application account", function () {
		const txParams = {
			...appCallParams,
			appArgs: ["str:modify_asa"],
			foreignAssets: [assetID],
			accounts: [elon.address, bob.address],
		};

		assert.throws(
			() => runtime.executeTx([txParams]),
			`RUNTIME_ERR1504: Only Manager account WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY can modify or destroy asset`
		);
	});

	it("should modify asset (by app account)", function () {
		// update asset manager to app account
		let asaDef = john.createdAssets.get(assetID);
		if (asaDef) asaDef.manager = appAccount.address;

		// assert ASA defined
		assert.isDefined(runtime.getAssetDef(assetID));

		// charlie is random address and not external address on application
		const txParams = {
			...appCallParams,
			appArgs: ["str:modify_asa"],
			foreignAssets: [assetID],
			accounts: [elon.address, charlie.address],
		};
		runtime.executeTx([txParams]);
		syncAccounts();

		// verify fields modified (according to asc logic)
		asaDef = runtime.getAssetDef(assetID);
		assert.deepEqual(asaDef.manager, txParams.accounts[0]);
		assert.deepEqual(asaDef.reserve, txParams.accounts[1]);
		assert.deepEqual(asaDef.freeze, txParams.fromAccount?.addr);
		assert.deepEqual(asaDef.clawback, appAccount.address);
	});

	it("should deploy a new ASA (by app account)", function () {
		// saved in global state, initially undefined
		let createdAsaID = runtime.getGlobalState(appID, "created_asa_key");
		assert.isUndefined(createdAsaID);
		const initialMinBalance = appAccount.minBalance;

		const txParams = {
			...appCallParams,
			appArgs: ["str:deploy_asa"],
		};
		runtime.executeTx([txParams]);
		syncAccounts();

		// verify asa created by contract
		createdAsaID = runtime.getGlobalState(appID, "created_asa_key");
		assert.isDefined(createdAsaID);

		const asaDef = runtime.getAssetDef(Number(createdAsaID));
		assert.isDefined(asaDef);
		assert.equal(asaDef.name, "gold");
		assert.equal(asaDef.decimals, 3);
		assert.equal(asaDef.defaultFrozen, false);
		assert.equal(asaDef.total, 10000000n);
		assert.deepEqual(asaDef.metadataHash, undefined);
		assert.equal(asaDef.unitName, "oz");
		assert.equal(asaDef.url, "https://gold.rush/");
		assert.equal(asaDef.manager, appAccount.address);
		assert.equal(asaDef.reserve, appAccount.address);
		assert.equal(asaDef.freeze, appAccount.address);
		assert.equal(asaDef.clawback, appAccount.address);

		// verify app account's min balance is also raised
		assert.equal(appAccount.minBalance, initialMinBalance + ASSET_CREATION_FEE);
	});

	it("should deploy a new ASA with app_args (by app account)", function () {
		// saved in global state, initially undefined
		let createdAsaID = runtime.getGlobalState(appID, "created_asa_key");
		assert.isUndefined(createdAsaID);
		const initialMinBalance = appAccount.minBalance;

		const txParams = {
			...appCallParams,
			appArgs: [
				"str:deploy_asa_with_app_args",
				"str:asa_name",
				"str:ipfs://ABCDEF",
				`addr:${charlie.address}`,
			],
		};
		runtime.executeTx([txParams]);
		syncAccounts();

		// verify asa created by contract
		createdAsaID = runtime.getGlobalState(appID, "created_asa_key");
		assert.isDefined(createdAsaID);

		const asaDef = runtime.getAssetDef(Number(createdAsaID));
		assert.isDefined(asaDef);
		assert.equal(asaDef.name, "asa_name");
		assert.equal(asaDef.decimals, 0);
		assert.equal(asaDef.defaultFrozen, true);
		assert.equal(asaDef.total, 1n);
		if (asaDef.metadataHash) {
			assert.deepEqual(
				asaDef.metadataHash,
				new Uint8Array(Buffer.from("12312442142141241244444411111133", "base64"))
			);
		}
		assert.equal(asaDef.unitName, "TEST");
		assert.equal(asaDef.url, "ipfs://ABCDEF");
		assert.equal(asaDef.manager, appAccount.address);
		assert.equal(asaDef.reserve, charlie.address);
		assert.equal(asaDef.freeze, charlie.address);
		assert.equal(asaDef.clawback, charlie.address);

		// verify ASA holding is set in creator account
		const creatorASAHolding = runtime.getAssetHolding(Number(createdAsaID), appAccount.address);
		assert.isDefined(creatorASAHolding);
		assert.equal(creatorASAHolding.amount, asaDef.total);
		assert.equal(creatorASAHolding["asset-id"], Number(createdAsaID));
		assert.equal(creatorASAHolding.creator, appAccount.address);
		assert.equal(creatorASAHolding["is-frozen"], false);

		// verify app account's min balance is also raised
		assert.equal(appAccount.minBalance, initialMinBalance + ASSET_CREATION_FEE);
	});
});
