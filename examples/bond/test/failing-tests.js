const { convert } = require("@algo-builder/algob");
const { Runtime, AccountStore } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { assert } = require("chai");
const {
	optInLsigToBond,
	createDex,
	approvalProgram,
	clearProgram,
	minBalance,
	initialBalance,
	redeem,
	placeholderParam,
} = require("./common/common");
const {
	buyTxRuntime,
	issueTx,
	redeemCouponTx,
	buyTx,
} = require("../scripts/run/common/common");

const RUNTIME_ERR1009 = "RUNTIME_ERR1009: TEAL runtime encountered err opcode";
const RUNTIME_ERR1402 = "Cannot withdraw";
const RUNTIME_ERR1506 = "Fee required";
const REJECTED_BY_LOGIC = "RUNTIME_ERR1007: Teal code rejected by logic";
const updateIssuer = "str:update_issuer_address";

describe("Bond token failing tests", function () {
	const master = new AccountStore(1000e6);
	let appManager = new AccountStore(initialBalance);
	let bondTokenCreator = new AccountStore(initialBalance);
	let issuerAddress = new AccountStore(minBalance);
	let elon = new AccountStore(initialBalance);
	let bob = new AccountStore(initialBalance);
	let dex1 = new AccountStore(initialBalance);
	let dex2 = new AccountStore(initialBalance);
	let randomUser = new AccountStore(initialBalance);

	let runtime;
	let appStorageConfig;
	let applicationId;
	let issuerLsigAddress;
	let lsig;
	let initialBond;

	this.beforeEach(async function () {
		runtime = new Runtime([
			appManager,
			bondTokenCreator,
			issuerAddress,
			master,
			elon,
			bob,
			dex1,
			dex2,
			randomUser,
		]);

		appStorageConfig = {
			localInts: 1,
			localBytes: 1,
			globalInts: 8,
			globalBytes: 15,
		};
	});

	// fetch latest account state
	function syncAccounts() {
		appManager = runtime.getAccount(appManager.address);
		bondTokenCreator = runtime.getAccount(bondTokenCreator.address);
		issuerAddress = runtime.getAccount(issuerAddress.address);
		elon = runtime.getAccount(elon.address);
		dex1 = runtime.getAccount(dex1.address);
		dex2 = runtime.getAccount(dex2.address);
		bob = runtime.getAccount(bob.address);
		randomUser = runtime.getAccount(randomUser.address);
	}

	// Bond-Dapp initialization parameters
	const appManagerPk = convert.addressToPk(appManager.address);
	const issuePrice = "int:1000";
	const couponValue = "int:20";
	const maxIssuance = "int:1000000";
	const bondCreator = convert.addressToPk(bondTokenCreator.address);

	this.beforeEach(async function () {
		initialBond = runtime.deployASA("bond-token-0", {
			creator: { ...bondTokenCreator.account, name: "bond-token-creator" },
		}).assetIndex;

		const appDefinition = Object.assign({}, appStorageConfig);
		const creationArgs = [
			appManagerPk,
			bondCreator,
			issuePrice,
			couponValue,
			`int:${initialBond}`,
			maxIssuance,
		];

		// deploy application
		applicationId = runtime.deployApp(
			appManager.account,
			{
				...appDefinition,
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

		// fund escrow with some minimum balance first
		runtime.fundLsig(master.account, issuerLsigAddress, minBalance + 10000);
	});

	function issue() {
		const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)];

		const appCallParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: appManager.account,
			appID: applicationId,
			payFlags: {},
			appArgs: appArgs,
		};
		runtime.executeTx([appCallParams]);
		optInLsigToBond(runtime, lsig, initialBond, appManager);
		// Issue tokens to issuer from bond token creator
		const groupTx = issueTx(bondTokenCreator.account, lsig, applicationId, initialBond);

		runtime.executeTx(groupTx);
	}

	function buy() {
		runtime.optInToASA(initialBond, elon.address, {});
		try {
			runtime.optInToApp(elon.address, applicationId, {}, {});
			// eslint-disable-next-line no-empty
		} catch (e) {} // can be already opted-in
		const amount = 10;
		const algoAmount = amount * 1000;

		const groupTx = buyTxRuntime(
			runtime,
			elon.account,
			lsig,
			algoAmount,
			applicationId,
			initialBond
		);
		runtime.executeTx(groupTx);
		syncAccounts();
	}

	it("Random user should not be able to update issuer's address", function () {
		// update application with correct issuer account address
		const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)]; // converts algorand address to Uint8Array

		const appCallParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: randomUser.account,
			appID: applicationId,
			payFlags: {},
			appArgs: appArgs,
		};

		assert.throws(() => runtime.executeTx([appCallParams]), RUNTIME_ERR1009);
	});

	it("Issuer should not be able to send asa without calling bond-dapp", function () {
		const params = {
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: issuerLsigAddress,
			lsig: lsig,
			toAccountAddr: elon.address,
			amount: 10,
			assetID: initialBond,
			payFlags: { totalFee: 1000 },
		};

		assert.throws(() => runtime.executeTx([params]), REJECTED_BY_LOGIC);
	});

	it("Opt-In to issuer lsig with single transaction should fail", function () {
		const optInTx = {
			type: types.TransactionType.OptInASA,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: issuerLsigAddress,
			lsig: lsig,
			assetID: initialBond,
			payFlags: {},
		};

		assert.throws(() => runtime.executeTx([optInTx]), REJECTED_BY_LOGIC);
	});

	// Avoid spamming of asset id's in bond-dapp
	it("Opt-In to issuer lsig without store manager signature should fail", function () {
		const optInTx = [
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: randomUser.account,
				toAccountAddr: issuerLsigAddress,
				amountMicroAlgos: 0,
				payFlags: {},
			},
			{
				type: types.TransactionType.OptInASA,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: issuerLsigAddress,
				lsig: lsig,
				assetID: initialBond,
				payFlags: {},
			},
		];

		assert.throws(() => runtime.executeTx(optInTx), REJECTED_BY_LOGIC);
	});

	it("Random user should not be able to update issue price", function () {
		const appArgs = ["str:update_issue_price", "int:0"];

		const appCallParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: randomUser.account,
			appID: runtime.getAppInfoFromName(approvalProgram, clearProgram).appID,
			payFlags: {},
			appArgs: appArgs,
		};

		assert.throws(() => runtime.executeTx([appCallParams]), RUNTIME_ERR1009);
	});

	it("should not issue shares to address other than issuer's address", function () {
		const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)];

		const appCallParams = {
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: appManager.account,
			appID: applicationId,
			payFlags: {},
			appArgs: appArgs,
		};
		runtime.executeTx([appCallParams]);
		optInLsigToBond(runtime, lsig, initialBond, appManager);
		runtime.optInToASA(initialBond, elon.address, {});

		const groupTx = issueTx(bondTokenCreator.account, lsig, applicationId, initialBond);
		groupTx[0].toAccountAddr = elon.address;

		assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
	});

	it("User should not be able to buy for less amount than specified", function () {
		issue();

		// Buy tokens from issuer
		runtime.optInToASA(initialBond, elon.address, {});
		runtime.optInToApp(elon.address, applicationId, {}, {});
		const algoAmount = 10 * 1000;

		const groupTx = buyTx(elon.account, lsig, 10, algoAmount - 10, applicationId, initialBond);

		assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
	});

	it("Only store manager can create dex", function () {
		issue();
		buy();

		assert.throws(
			() => createDex(runtime, bondTokenCreator, elon, 1, master, lsig),
			REJECTED_BY_LOGIC
		);
	});

	it("Buyer cannot redeem more than they have", function () {
		issue();
		buy();
		// manager starts epoch 1 (create dex)
		const dexLsig1 = createDex(runtime, bondTokenCreator, appManager, 1, master, lsig);
		syncAccounts();
		// sync dex account
		dex1 = runtime.getAccount(dexLsig1.address());

		assert.throws(() => redeem(runtime, elon, 1, 20, dexLsig1), RUNTIME_ERR1402);
	});

	it("Buyer tries to buy bonds without paying fees", function () {
		issue();
		// Buy tokens from issuer
		runtime.optInToASA(initialBond, elon.address, {});
		const algoAmount = 10 * 1000;

		const groupTx = buyTxRuntime(
			runtime,
			elon.account,
			lsig,
			algoAmount,
			applicationId,
			initialBond
		);
		groupTx[0].payFlags = { totalFee: 1000 };
		groupTx[1].payFlags = { totalFee: 1000 };

		assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);

		groupTx[1].payFlags = { totalFee: 0 };
		assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1506);
	});

	it("Buyer tries to exchange bonds without paying fees", function () {
		issue();
		buy();
		// manager starts epoch 1 (create dex)
		const dexLsig1 = createDex(runtime, bondTokenCreator, appManager, 1, master, lsig);
		syncAccounts();
		// sync dex account
		dex1 = runtime.getAccount(dexLsig1.address());

		const appInfo = runtime.getAppInfoFromName(approvalProgram, clearProgram);
		const oldBond = runtime.getAssetInfoFromName("bond-token-0").assetIndex;
		const newBond = runtime.getAssetInfoFromName("bond-token-1").assetIndex;

		const groupTx = redeemCouponTx(
			elon.account,
			dexLsig1,
			1,
			oldBond,
			newBond,
			20,
			appInfo.appID
		);
		groupTx[0].payFlags = { totalFee: 2000 };
		groupTx[1].payFlags = { totalFee: 1000 };
		groupTx[2].payFlags = { totalFee: 0 };
		groupTx[3].payFlags = { totalFee: 1000 };

		assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);

		groupTx[1].payFlags = { totalFee: 0 };
		groupTx[2].payFlags = { totalFee: 1000 };
		assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
	});
});
