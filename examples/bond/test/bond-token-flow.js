const { convert } = require("@algo-builder/algob");
const { Runtime, AccountStore } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { assert } = require("chai");

const {
	optInLsigToBond,
	createDex,
	minBalance,
	initialBalance,
	issue,
	redeem,
	approvalProgram,
	clearProgram,
	placeholderParam,
} = require("./common/common");
const { buyTxRuntime, issueTx } = require("../scripts/run/common/common");

/**
 * Test for the scenario described in Readme.md
 */
describe("Bond token Tests", function () {
	let issuerAddress = new AccountStore(minBalance);
	const master = new AccountStore(1000e6);
	let appManager;
	let bondTokenCreator;
	let elon;
	let bob;
	let dex1;
	let dex2;

	const runtime = new Runtime([master, issuerAddress]);
	[appManager, bondTokenCreator, elon, bob, dex1, dex2] = runtime.defaultAccounts();

	let appStorageConfig;
	let applicationId;
	let issuerLsigAddress;
	let lsig;

	this.beforeAll(() => {
		appStorageConfig = {
			localInts: 1,
			localBytes: 1,
			globalInts: 8,
			globalBytes: 15,
		};
	});

	const getGlobal = (key) => runtime.getGlobalState(applicationId, key);

	// fetch latest account state
	function syncAccounts() {
		issuerAddress = runtime.getAccount(issuerAddress.address);
		[appManager, bondTokenCreator, elon, bob, dex1, dex2] = runtime.defaultAccounts();
	}

	// Bond-Dapp initialization parameters
	const appManagerPk = convert.addressToPk(appManager.address);
	const issuePrice = "int:1000";
	const couponValue = "int:20";
	const maxIssuance = "int:1000000";
	const bondCreator = convert.addressToPk(bondTokenCreator.address);

	it("Bond token application", () => {
		/**
		 * Issue initial bond tokens to the issuer
		 * In epoch_0 elon buys 10 bonds
		 * In epoch 0 elon sells 2 bonds to bob for 2020 ALGO (in a group transaction)
		 * Manager creates dex 1
		 * Elon redeems his bonds (8), Elon buys 4 more bonds (so he will have 12 bonds in total)
		 * Manager creates dex 2
		 * Elon redeems all his bonds.
		 * Bob redeems his bonds from epoch 0 and 1
		 * Maturity period is set to 240 seconds(4 min) after the contract deployment.
		 * At maturity, manager creates and funds buyback and both elon and
		 * bob can exit all their tokens (12 and 2 respectively).
		 */

		const currentBondIndex = runtime.deployASA("bond-token-0", {
			creator: { ...bondTokenCreator.account, name: "bond-token-creator" },
		}).assetIndex;

		const creationFlags = Object.assign({}, appStorageConfig);
		const creationArgs = [
			appManagerPk,
			bondCreator,
			issuePrice,
			couponValue,
			`int:${currentBondIndex}`,
			maxIssuance,
		];

		// create application
		applicationId = runtime.deployApp(
			appManager.account,
			{
				...creationFlags,
				appName: "bond",
				metaType: types.MetaType.SOURCE_CODE,
				approvalProgramCode: approvalProgram,
				clearProgramCode: clearProgram,
				appArgs: creationArgs,
			},
			{},
			placeholderParam
		).appID;

		// setup lsig account
		// Initialize issuer lsig with bond-app ID
		const scInitParam = {
			TMPL_APPLICATION_ID: applicationId,
			TMPL_OWNER: bondTokenCreator.address,
			TMPL_APP_MANAGER: appManager.address,
		};
		lsig = runtime.loadLogic("issuer-lsig.py", scInitParam);
		issuerLsigAddress = lsig.address();

		// sync escrow account
		issuerAddress = runtime.getAccount(issuerLsigAddress);
		console.log("Issuer Address: ", issuerLsigAddress);

		// fund escrow with some minimum balance first
		runtime.fundLsig(master.account, issuerLsigAddress, minBalance + 10000);

		// verify global state
		assert.isDefined(applicationId);
		assert.deepEqual(getGlobal("app_manager"), convert.addressToPk(appManager.address));
		assert.deepEqual(getGlobal("issue_price"), 1000n);
		assert.deepEqual(getGlobal("coupon_value"), 20n);
		assert.deepEqual(getGlobal("epoch"), 0n);
		assert.deepEqual(getGlobal("current_bond"), BigInt(currentBondIndex));

		// update application with correct issuer account address
		const appArgs = ["str:update_issuer_address", convert.addressToPk(issuerLsigAddress)]; // converts algorand address to Uint8Array

		const appCallParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: appManager.account,
			appID: applicationId,
			payFlags: {},
			appArgs: appArgs,
		};
		runtime.executeTx([appCallParams]);

		// verify issuer address
		assert.isDefined(applicationId);
		assert.deepEqual(getGlobal("issuer_address"), convert.addressToPk(issuerLsigAddress));

		// opt-in to app
		runtime.optInToApp(appManager.address, applicationId, {}, {});
		runtime.optInToApp(issuerAddress.address, applicationId, {}, {});

		syncAccounts();
		assert.isDefined(appManager.appsLocalState.get(applicationId));
		assert.isDefined(issuerAddress.appsLocalState.get(applicationId));

		optInLsigToBond(runtime, lsig, currentBondIndex, appManager);
		// Issue tokens to issuer from bond token creator
		let groupTx = issueTx(bondTokenCreator.account, lsig, applicationId, currentBondIndex);
		runtime.executeTx(groupTx);

		syncAccounts();
		assert.equal(issuerAddress.getAssetHolding(currentBondIndex)?.amount, 1000000n);

		// at epoch_0 elon buys 10 bonds
		runtime.optIntoASA(currentBondIndex, elon.address, {});
		runtime.optInToApp(elon.address, applicationId, {}, {});
		let amount = 10;
		let algoAmount = amount * issue;

		groupTx = buyTxRuntime(
			runtime,
			elon.account,
			lsig,
			algoAmount,
			applicationId,
			currentBondIndex
		);
		runtime.executeTx(groupTx);

		syncAccounts();
		assert.equal(elon.getAssetHolding(currentBondIndex)?.amount, 10n);

		runtime.optIntoASA(currentBondIndex, bob.address, {});
		// elon sells 2 bonds to bob for 2020 Algo
		const sellTx = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: bob.account,
				toAccountAddr: bob.address,
				amountMicroAlgos: 2020,
				payFlags: { totalFee: 1000 },
			},
			{
				type: types.TransactionType.TransferAsset,
				sign: types.SignType.SecretKey,
				fromAccount: elon.account,
				toAccountAddr: bob.address,
				amount: 2,
				assetID: currentBondIndex,
				payFlags: { totalFee: 1000 },
			},
		];

		runtime.executeTx(sellTx);
		syncAccounts();
		assert.equal(elon.getAssetHolding(currentBondIndex)?.amount, 8n);
		assert.equal(bob.getAssetHolding(currentBondIndex)?.amount, 2n);

		// manager starts epoch 1 (create dex)
		const dexLsig1 = createDex(runtime, bondTokenCreator, appManager, 1, master, lsig);

		syncAccounts();
		// sync dex account
		dex1 = runtime.getAccount(dexLsig1.address());
		console.log("Dex 1 Address: ", dexLsig1.address());

		// elon redeems his 8 bonds
		redeem(runtime, elon, 1, 8, dexLsig1);

		amount = 4;
		algoAmount = amount * issue;
		const bond1 = runtime.getAssetInfoFromName("bond-token-1").assetIndex;
		// elon buys 4 more bonds
		groupTx = buyTxRuntime(runtime, elon.account, lsig, algoAmount, applicationId, bond1);
		runtime.executeTx(groupTx);

		syncAccounts();
		assert.equal(elon.getAssetHolding(bond1)?.amount, 12n);

		// manager starts epoch 2 (create dex)
		const dexLsig2 = createDex(runtime, bondTokenCreator, appManager, 2, master, lsig);
		syncAccounts();
		// sync dex account
		dex2 = runtime.getAccount(dexLsig2.address());
		console.log("Dex 2 Address: ", dexLsig2.address());

		// elon redeems his 12 bonds
		redeem(runtime, elon, 2, 12, dexLsig2);

		// bob redeems bond_1
		redeem(runtime, bob, 1, 2, dexLsig1);
		syncAccounts();
		// bob redeems bond_2
		redeem(runtime, bob, 2, 2, dexLsig2);

		const bond2 = runtime.getAssetInfoFromName("bond-token-2").assetIndex;
		// create buyback
		const scParam = {
			TMPL_APPLICATION_ID: applicationId,
			TMPL_APP_MANAGER: appManager.address,
			TMPL_BOND: bond2,
		};
		const buybackLsig = runtime.loadLogic("buyback-lsig.py", scParam);

		// fund dex with some minimum balance first
		runtime.fundLsig(master.account, buybackLsig.address(), minBalance + 10000);

		const buybackTx = [
			{
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: appManager.account,
				appID: applicationId,
				payFlags: {},
				appArgs: ["str:set_buyback", convert.addressToPk(buybackLsig.address())],
			},
		];

		optInLsigToBond(runtime, buybackLsig, bond2, appManager);

		runtime.executeTx(buybackTx);

		runtime.setRoundAndTimestamp(3, Math.round(new Date().getTime() / 1000) + 250);

		syncAccounts();
		// Algo balance before exit
		const beforeExitElon = elon.balance();
		const beforeExitBob = bob.balance();

		const exitBond = 12;
		const nominalPrice = 1000;
		const exitAmount = Number(exitBond) * Number(nominalPrice);
		// Exit tokens from elon
		const exitTx = [
			//  Bond token transfer to buyback address
			{
				type: types.TransactionType.TransferAsset,
				sign: types.SignType.SecretKey,
				fromAccount: elon.account,
				toAccountAddr: buybackLsig.address(),
				amount: exitBond,
				assetID: bond2,
				payFlags: { totalFee: 2000 },
			},
			// Nominal price * amount paid to buyer
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: buybackLsig.address(),
				lsig: buybackLsig,
				toAccountAddr: elon.address,
				amountMicroAlgos: exitAmount,
				payFlags: { totalFee: 0 },
			},
			// call to bond-dapp
			{
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: elon.account,
				appID: applicationId,
				payFlags: { totalFee: 1000 },
				appArgs: ["str:exit"],
			},
		];

		runtime.executeTx(exitTx);

		// Exit tokens from bob
		exitTx[0].fromAccount = bob.account;
		exitTx[0].amount = 2;
		exitTx[1].toAccountAddr = bob.address;
		exitTx[1].amountMicroAlgos = 2000;
		exitTx[2].fromAccount = bob.account;

		runtime.executeTx(exitTx);
		syncAccounts();
		const feePaid = 3000n;
		assert.equal(bob.getAssetHolding(bond1)?.amount, 0n);
		assert.equal(bob.getAssetHolding(bond2)?.amount, 0n);
		assert.equal(elon.getAssetHolding(bond1)?.amount, 0n);
		assert.equal(elon.getAssetHolding(bond2)?.amount, 0n);
		assert.equal(beforeExitElon + 12000n - feePaid, elon.balance());
		assert.equal(beforeExitBob + 2000n - feePaid, bob.balance());
	});
});
