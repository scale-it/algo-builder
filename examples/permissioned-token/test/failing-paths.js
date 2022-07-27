const { AccountStore } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { assert } = require("chai");
const { encodeAddress, default: algosdk } = require("algosdk");
const { Context } = require("./common");
const STR_TRANSFER = "str:transfer";
const RUNTIME_ERR1009 = "RUNTIME_ERR1009: TEAL runtime encountered err opcode";
const INDEX_OUT_OF_BOUND_ERR = "RUNTIME_ERR1008: Index out of bound";
const REJECTED_BY_LOGIC = "RUNTIME_ERR1007: Teal code rejected by logic";
const FORCE_TRANSFER_APPARG = "str:force_transfer";

describe("Permissioned Token Tests - Failing Paths", function () {
	let master, alice, bob, elon;
	let asaDef, asaReserve, asaManager;
	let ctx;

	function setUpCtx() {
		master = new AccountStore(10000e6);
		ctx = new Context(master);
		[alice, bob, elon] = ctx.defaultAccounts();
		asaDef = ctx.getAssetDef();
		asaReserve = ctx.getAccount(asaDef.reserve);
		asaManager = ctx.getAccount(asaDef.manager);
	}

	describe("Token Issuance", function () {
		this.beforeAll(setUpCtx);

		it("should not issue token if receiver is not opted in", () => {
			assert.throws(
				() => ctx.issue(asaReserve.account, elon, 20),
				`RUNTIME_ERR1404: Account ${elon.address} doesn't hold asset index ${ctx.assetIndex}`
			);
		});

		it("should not issue if token is killed", () => {
			// Opt-in to ASA by receiver
			ctx.optInToASA(elon.address);

			ctx.killToken(asaManager.account);
			assert.throws(() => ctx.issue(asaReserve.account, elon, 20), RUNTIME_ERR1009);
		});

		it("should reject issuance tx if sender is not token reserve", () => {
			// Opt-in to ASA by receiver
			ctx.optInToASA(elon.address);
			assert.throws(() => ctx.issue(bob.account, elon, 20), RUNTIME_ERR1009);
		});

		it("should reject issuance tx if trying to send asset using secret key instead of clawback", () => {
			// Opt-in to ASA by receiver
			ctx.optInToASA(elon.address);

			const txParams = [
				{
					type: types.TransactionType.TransferAsset,
					sign: types.SignType.SecretKey,
					fromAccount: asaReserve.account,
					toAccountAddr: elon.address,
					amount: 20n,
					assetID: ctx.assetIndex,
					payFlags: {},
				},
			];

			// should fail as we can only use clawback (since asset is default-frozen)
			assert.throws(
				() => ctx.runtime.executeTx(txParams),
				`RUNTIME_ERR1405: Asset index ${ctx.assetIndex} frozen for account ${elon.address}`
			);
		});
	});

	describe("Kill Token", function () {
		this.beforeAll(setUpCtx);

		it("should reject tx to kill token if sender is not token manager", () => {
			// verify bob is not token manager
			assert.notEqual(asaManager.address, bob.address);
			// fails: bob trying to kill token
			assert.throws(() => ctx.killToken(bob.account), RUNTIME_ERR1009);
		});
	});

	describe("WhiteListing", function () {
		this.beforeAll(setUpCtx);

		let permManagerAddr, permManager, whitelistParams;
		this.beforeEach(() => {
			permManagerAddr = encodeAddress(
				ctx.runtime.getGlobalState(ctx.permissionsappID, "manager")
			);
			permManager = ctx.getAccount(permManagerAddr);

			whitelistParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: permManager.account,
				appID: ctx.permissionsappID,
				payFlags: { totalFee: 1000 },
				appArgs: ["str:add_whitelist"],
				accounts: [elon.address],
			};
		});

		it("should reject account whitelist if the account doesn't opt-in to permissions app", () => {
			// verify account not opted in
			assert.isUndefined(ctx.elon.getAppFromLocal(ctx.permissionsappID));

			// Fails because elon is not opted in
			assert.throws(
				() => ctx.runtime.executeTx([{ ...whitelistParams }]),
				`RUNTIME_ERR1306: Application Index ${ctx.permissionsappID} not found or is invalid`
			);
		});

		it("should not whitelist account if sender is not current permissions manager", () => {
			// opt-in to permissions by elon
			ctx.optInToPermissionsSSC(elon.address);
			ctx.syncAccounts();
			assert.isDefined(ctx.elon.getAppFromLocal(ctx.permissionsappID));

			// Fails because Bob is not the manager
			assert.notEqual(permManager.address, bob.address); // verify bob is not permissions manager
			assert.throws(
				() =>
					ctx.runtime.executeTx([
						{
							...whitelistParams,
							fromAccount: bob.account, // Bob is not the asset manager
						},
					]),
				RUNTIME_ERR1009
			);
		});
	});

	describe("Opt Out", function () {
		it("should reject tx if user not opted-in", () => {
			const asaCreator = ctx.getAccount(asaDef.creator);
			assert.throws(
				() => ctx.optOut(asaCreator.address, elon.account),
				`RUNTIME_ERR1404: Account ${ctx.elon.address} doesn't hold asset index ${ctx.assetIndex}`
			);
		});
	});

	describe("Change Permissions Manager", function () {
		this.beforeAll(setUpCtx);

		it("should fail if sender is not current permissions manager", () => {
			const permManagerAddr = encodeAddress(
				ctx.runtime.getGlobalState(ctx.permissionsappID, "manager")
			);
			const permManager = ctx.getAccount(permManagerAddr);
			assert.notEqual(permManager.address, bob.address); // verify bob is not current permissions manager

			const txParams = [
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: bob.account,
					appID: ctx.permissionsappID,
					payFlags: { totalFee: 1000 },
					appArgs: ["str:change_permissions_manager"],
					accounts: [elon.address],
				},
			];
			assert.throws(
				() => ctx.runtime.executeTx(txParams), // fails as fromAccount is not the current permissions manager
				RUNTIME_ERR1009
			);
		});
	});

	describe("Force Transfer(Clawback)", function () {
		this.beforeAll(setUpCtx);

		let permManagerAddr, permManager, forceTransferGroup;
		this.beforeEach(() => {
			permManagerAddr = encodeAddress(
				ctx.runtime.getGlobalState(ctx.permissionsappID, "manager")
			);
			permManager = ctx.getAccount(permManagerAddr);

			// Opt-In to ASA by bob and elon (accA, accB)
			ctx.optInToASA(bob.address);
			ctx.optInToASA(elon.address);

			// transaction group for forced token transfer between two non-reserve accounts
			// note that sender is asa.manager
			forceTransferGroup = [
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					appID: ctx.controllerappID,
					payFlags: { totalFee: 1000 },
					appArgs: [FORCE_TRANSFER_APPARG],
					foreignAssets: [ctx.assetIndex],
				},
				{
					type: types.TransactionType.RevokeAsset,
					sign: types.SignType.LogicSignature,
					fromAccountAddr: ctx.lsig.address(),
					recipient: elon.address,
					assetID: ctx.assetIndex,
					revocationTarget: bob.address,
					amount: 20n,
					lsig: ctx.lsig,
					payFlags: { totalFee: 1000 },
				},
				{
					type: types.TransactionType.TransferAlgo,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					toAccountAddr: ctx.lsig.address(),
					amountMicroAlgos: 1000,
					payFlags: { totalFee: 1000 },
				},
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					appID: ctx.permissionsappID,
					payFlags: { totalFee: 1000 },
					appArgs: [STR_TRANSFER],
					accounts: [bob.address, elon.address],
				},
			];
		});

		it("Should fail on force transfer if transaction group is not valid", () => {
			const forceTxGroup = [...forceTransferGroup];

			// fails as permissions is not called
			assert.throws(
				() => ctx.runtime.executeTx([forceTxGroup[0], forceTxGroup[1], forceTxGroup[2]]),
				INDEX_OUT_OF_BOUND_ERR
			);

			// fails if only trying to use clawback transaction to transfer asset
			assert.throws(() => ctx.runtime.executeTx([forceTxGroup[1]]), INDEX_OUT_OF_BOUND_ERR);

			// fails as paying fees of clawback-lsig is skipped
			assert.throws(
				() => ctx.runtime.executeTx([forceTxGroup[0], forceTxGroup[1], forceTxGroup[3]]),
				INDEX_OUT_OF_BOUND_ERR
			);

			// fails as controller is not called
			assert.throws(
				() => ctx.runtime.executeTx([forceTxGroup[1], forceTxGroup[2], forceTxGroup[3]]),
				REJECTED_BY_LOGIC
			);
		});

		it("should reject transfer if transaction group is valid but controller.sender is not equal to asset.sender", () => {
			const forceTxGroup = [...forceTransferGroup];
			forceTxGroup[0].fromAccount = elon.account;

			assert.throws(() => ctx.runtime.executeTx(forceTxGroup), RUNTIME_ERR1009);
		});

		it("Should reject force transfer if accounts are not whitelisted", () => {
			// Issue some tokens to sender
			ctx.issue(asaReserve.account, bob, 150);
			ctx.syncAccounts();

			// Fails as both sender, receiver are not whitelisted
			assert.throws(
				() => ctx.forceTransfer(asaManager.account, bob, elon, 20),
				RUNTIME_ERR1009
			);

			// still fails as sender is whitelisted but receiver is not
			ctx.whitelist(permManager.account, bob.address);
			ctx.syncAccounts();
			assert.throws(
				() => ctx.forceTransfer(asaManager.account, bob, elon, 20),
				RUNTIME_ERR1009
			);

			// passes now as both sender, receiver are whitelisted
			ctx.whitelist(permManager.account, elon.address);
			ctx.syncAccounts();
			ctx.forceTransfer(asaManager.account, bob, elon, 20);
		});

		it("Should reject transfer if sender is not token manager", () => {
			// Opt-In to permissions SSC & Whitelist
			ctx.whitelist(permManager.account, elon.address);
			ctx.whitelist(permManager.account, bob.address);
			ctx.syncAccounts();

			// Issue some tokens to sender
			ctx.issue(asaReserve.account, bob, 150);
			ctx.syncAccounts();

			// Fails as only asset manager(alice) can perform force transfer
			assert.notEqual(asaManager.address, bob.address);
			assert.throws(() => ctx.forceTransfer(bob.account, bob, elon, 20), RUNTIME_ERR1009);
		});

		it("Should reject force transfer if accounts are whitelisted but receiver balance becomes > 100", () => {
			// Opt-In to permissions SSC & Whitelist
			ctx.whitelist(permManager.account, elon.address);
			ctx.whitelist(permManager.account, bob.address);
			ctx.syncAccounts();

			// Issue some tokens to sender
			ctx.issue(asaReserve.account, bob, 150);
			ctx.syncAccounts();

			// Fails as receiver balance becomes > 100 now
			assert.throws(
				() => ctx.forceTransfer(asaManager.account, bob, elon, 110),
				RUNTIME_ERR1009
			);
		});

		it("Should reject force transfer if token is killed", () => {
			// Opt-In to permissions SSC & Whitelist
			ctx.whitelist(permManager.account, elon.address);
			ctx.whitelist(permManager.account, bob.address);
			ctx.syncAccounts();

			// Issue some tokens to sender and kill token
			ctx.issue(asaReserve.account, bob, 150);
			ctx.killToken(asaManager.account);
			ctx.syncAccounts();

			// fails as accounts are whitelisted, amount is good but token is killed
			assert.throws(
				() => ctx.forceTransfer(asaManager.account, bob, elon, 20),
				RUNTIME_ERR1009
			);
		});
	});

	describe("Token Transfer", function () {
		this.beforeAll(setUpCtx);

		let permManagerAddr, permManager, tokenTransferGroup;
		this.beforeEach(() => {
			permManagerAddr = encodeAddress(
				ctx.runtime.getGlobalState(ctx.permissionsappID, "manager")
			);
			permManager = ctx.getAccount(permManagerAddr);

			// Opt-In to ASA by bob and elon (accA, accB)
			ctx.optInToASA(bob.address);
			ctx.optInToASA(elon.address);

			// transaction group for token transfer between two non-reserve accounts
			tokenTransferGroup = [
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: bob.account,
					appID: ctx.controllerappID,
					payFlags: { totalFee: 1000 },
					appArgs: [STR_TRANSFER],
					foreignAssets: [ctx.assetIndex],
				},
				{
					type: types.TransactionType.RevokeAsset,
					sign: types.SignType.LogicSignature,
					fromAccountAddr: ctx.lsig.address(),
					recipient: elon.address,
					assetID: ctx.assetIndex,
					revocationTarget: bob.address,
					amount: 20n,
					lsig: ctx.lsig,
					payFlags: { totalFee: 1000 },
				},
				{
					type: types.TransactionType.TransferAlgo,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					toAccountAddr: ctx.lsig.address(),
					amountMicroAlgos: 1000,
					payFlags: { totalFee: 1000 },
				},
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: bob.account,
					appID: ctx.permissionsappID,
					payFlags: { totalFee: 1000 },
					appArgs: [STR_TRANSFER],
					accounts: [bob.address, elon.address],
				},
			];
		});

		it("Should fail if transaction group is not valid", () => {
			const txGroup = [...tokenTransferGroup];

			// fails as permissions is not called
			assert.throws(
				() => ctx.runtime.executeTx([txGroup[0], txGroup[1], txGroup[2]]),
				INDEX_OUT_OF_BOUND_ERR
			);

			// fails if only trying to use clawback transaction to transfer asset
			assert.throws(() => ctx.runtime.executeTx([txGroup[1]]), INDEX_OUT_OF_BOUND_ERR);

			// fails as paying fees of clawback-lsig is skipped
			assert.throws(
				() => ctx.runtime.executeTx([txGroup[0], txGroup[1], txGroup[3]]),
				INDEX_OUT_OF_BOUND_ERR
			);

			// fails as controller is not called (rejected by clawback)
			assert.throws(
				() => ctx.runtime.executeTx([txGroup[1], txGroup[2], txGroup[3]]),
				REJECTED_BY_LOGIC
			);
		});

		it("should reject transfer if transaction group is valid but controller.sender is not equal to asset.sender", () => {
			const txGroup = [...tokenTransferGroup];
			txGroup[0].fromAccount = elon.account;

			assert.throws(() => ctx.runtime.executeTx(txGroup), RUNTIME_ERR1009);
		});

		it("should reject transfer if sender trying to transfer token using secret key instead of clawback", () => {
			const assetTransferParams = {
				type: types.TransactionType.TransferAsset,
				sign: types.SignType.SecretKey,
				fromAccount: bob.account,
				toAccountAddr: elon.address,
				amount: 20n,
				assetID: ctx.assetIndex,
				payFlags: {},
			};

			// should fail as we can only use clawback (since asset is default-frozen)
			assert.throws(
				() => ctx.runtime.executeTx([assetTransferParams]),
				`RUNTIME_ERR1405: Asset index ${ctx.assetIndex} frozen for account ${bob.address}`
			);
		});

		it("Should reject transfer if accounts are not whitelisted", () => {
			// Issue some tokens to sender
			ctx.issue(asaReserve.account, bob, 150);
			ctx.syncAccounts();

			// Fails as both sender, receiver are not whitelisted
			assert.throws(() => ctx.transfer(bob, elon, 20), RUNTIME_ERR1009);

			// still fails as sender is whitelisted but receiver is not
			ctx.whitelist(permManager.account, bob.address);
			ctx.syncAccounts();
			assert.throws(() => ctx.transfer(bob, elon, 20), RUNTIME_ERR1009);

			// passes now as both sender, receiver are whitelisted
			ctx.whitelist(permManager.account, elon.address);
			ctx.syncAccounts();
			ctx.transfer(bob, elon, 20);
		});

		it("Should reject force transfer if accounts are whitelisted but receiver balance becomes > 100", () => {
			// Opt-In to permissions SSC & Whitelist
			ctx.whitelist(permManager.account, elon.address);
			ctx.whitelist(permManager.account, bob.address);
			ctx.syncAccounts();

			// Issue some tokens to sender
			ctx.issue(asaReserve.account, bob, 150);
			ctx.syncAccounts();

			// Fails as receiver balance becomes > 100 now
			assert.throws(() => ctx.transfer(bob, elon, 105), RUNTIME_ERR1009);
		});

		it("should reject transfer if rules are followed, but token is killed", () => {
			// Opt-In to permissions SSC & Whitelist
			ctx.whitelist(permManager.account, elon.address);
			ctx.whitelist(permManager.account, bob.address);
			ctx.syncAccounts();

			// Issue some tokens to sender & kill token
			ctx.issue(asaReserve.account, bob, 150);
			ctx.killToken(asaManager.account);
			ctx.syncAccounts();

			// fails as accounts are whitelisted, amount is good but token is killed
			assert.throws(() => ctx.transfer(bob, elon, 10), RUNTIME_ERR1009);
		});
	});

	describe("Update token reserve", function () {
		this.beforeAll(setUpCtx);

		let updateReserveParams;
		this.beforeEach(() => {
			const oldReserveAssetHolding = ctx.getAssetHolding(asaReserve.address);
			const newReserveAddr = elon.address;
			ctx.optInToASA(newReserveAddr);

			// transaction group to update reserve account
			updateReserveParams = [
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					appID: ctx.controllerappID,
					payFlags: { totalFee: 1000 },
					appArgs: [FORCE_TRANSFER_APPARG],
					foreignAssets: [ctx.assetIndex],
				},
				{
					type: types.TransactionType.RevokeAsset,
					sign: types.SignType.LogicSignature,
					fromAccountAddr: ctx.lsig.address(),
					recipient: newReserveAddr,
					assetID: ctx.assetIndex,
					revocationTarget: asaReserve.address,
					amount: oldReserveAssetHolding.amount, // moving all tokens to new reserve
					lsig: ctx.lsig,
					payFlags: { totalFee: 1000 },
				},
				{
					type: types.TransactionType.TransferAlgo,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					toAccountAddr: ctx.lsig.address(),
					amountMicroAlgos: 1000,
					payFlags: { totalFee: 1000 },
				},
				{
					type: types.TransactionType.ModifyAsset,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					assetID: ctx.assetIndex,
					fields: {
						manager: asaDef.manager,
						reserve: newReserveAddr,
						freeze: asaDef.freeze,
						clawback: ctx.lsig.address(),
					},
					payFlags: { totalFee: 1000 },
				},
			];
		});

		it("Should fail if transaction group is not valid", () => {
			const txGroup = [...updateReserveParams];

			// fails as paying fees of clawback-lsig is skipped
			assert.throws(
				() => ctx.runtime.executeTx([txGroup[0], txGroup[1], txGroup[3]]),
				INDEX_OUT_OF_BOUND_ERR
			);

			// fails as controller is not called (rejected by clawback)
			assert.throws(
				() => ctx.runtime.executeTx([txGroup[1], txGroup[2], txGroup[3]]),
				REJECTED_BY_LOGIC
			);
		});

		it("should reject update if controller.sender is not asset manager", () => {
			const txGroup = [...updateReserveParams];
			txGroup[0].fromAccount = bob.account;

			// fails as controller's sender is not asset manager
			assert.notEqual(asaManager.address, bob.address);
			assert.throws(() => ctx.runtime.executeTx(txGroup), RUNTIME_ERR1009);
		});

		it("should reject update if sender of asset config tx is not asset manager", () => {
			const txGroup = [...updateReserveParams];
			txGroup[3].fromAccount = bob.account;

			// fails as controller's sender is not asset manager
			assert.notEqual(asaManager.address, bob.address);
			assert.throws(
				() => ctx.runtime.executeTx(txGroup),
				`RUNTIME_ERR1504: Only Manager account ${asaManager.address} can modify or destroy asset`
			);
		});
	});

	describe("Cease", function () {
		this.beforeAll(setUpCtx);

		let permManagerAddr, permManager, ceaseTxGroup;
		this.beforeEach(() => {
			permManagerAddr = encodeAddress(
				ctx.runtime.getGlobalState(ctx.permissionsappID, "manager")
			);
			permManager = ctx.getAccount(permManagerAddr);

			// Opt-In to ASA by bob
			ctx.optInToASA(bob.address);
			ceaseTxGroup = [
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					appID: ctx.controllerappID,
					payFlags: { totalFee: 2000 },
					appArgs: [FORCE_TRANSFER_APPARG],
					foreignAssets: [ctx.assetIndex],
				},
				{
					type: types.TransactionType.RevokeAsset,
					sign: types.SignType.LogicSignature,
					fromAccountAddr: ctx.lsig.address(),
					recipient: asaReserve.address,
					assetID: ctx.assetIndex,
					revocationTarget: bob.address,
					amount: 20n,
					lsig: ctx.lsig,
					payFlags: { totalFee: 2000 },
				},
				{
					type: types.TransactionType.TransferAlgo,
					sign: types.SignType.SecretKey,
					fromAccount: asaManager.account,
					toAccountAddr: ctx.lsig.address(),
					amountMicroAlgos: 2000,
					payFlags: { totalFee: 1000 },
				},
			];
		});

		it("Should fail if transaction group is invalid", () => {
			const txGroup = [...ceaseTxGroup];

			// fails because paying fees of clawback-lsig is skipped
			assert.throws(() => ctx.runtime.executeTx([txGroup[0], txGroup[1]]), RUNTIME_ERR1009);

			// fails because controller is not called (rejected by clawback)
			assert.throws(() => ctx.runtime.executeTx([txGroup[1], txGroup[2]]), REJECTED_BY_LOGIC);
		});

		it("should reject cease if call to controller is not signed by asset manager", () => {
			const txGroup = [...ceaseTxGroup];
			txGroup[0].fromAccount = bob.account;

			// fails because controller's sender is not asset manager
			assert.notEqual(asaManager.address, bob.address);
			assert.throws(() => ctx.runtime.executeTx(txGroup), RUNTIME_ERR1009);
		});

		it("Should fail if trying to cease more tokens than issued", () => {
			const txGroup = [...ceaseTxGroup];
			// Opt-In to permissions SSC & Whitelist
			ctx.whitelist(permManager.account, bob.address);

			// Issue some tokens to sender
			ctx.issue(asaReserve.account, bob, 200);
			ctx.syncAccounts();

			// confirm issuance
			assert.equal(ctx.bob.getAssetHolding(ctx.assetIndex).amount, 200n);

			// issued 200 tokens but trying to cease 300
			txGroup[1].amount = 300n;
			assert.throws(
				() => ctx.runtime.executeTx(txGroup),
				`RUNTIME_ERR1402: Cannot withdraw 300 assets from account ${bob.address}: insufficient balance`
			);
		});

		it("Should fail token index is not valid", () => {
			const txGroup = [...ceaseTxGroup];

			txGroup[0].foreignAssets = [99];
			assert.throws(() => ctx.runtime.executeTx(txGroup), RUNTIME_ERR1009);
		});

		it("Should fail if sufficient fees is not covered in fee payment tx", () => {
			const txGroup = [...ceaseTxGroup];

			txGroup[2].amountMicroAlgos = txGroup[1].payFlags.totalFee - 100;
			assert.throws(() => ctx.runtime.executeTx(txGroup), REJECTED_BY_LOGIC);
		});

		it("should reject cease if token is killed", () => {
			const txGroup = [...ceaseTxGroup];
			ctx.whitelist(permManager.account, bob.address);
			ctx.issue(asaReserve.account, bob, 200);
			ctx.killToken(asaManager.account); // kill token
			ctx.syncAccounts();

			// fails because accounts are whitelisted, amount condition is satisfied but token is killed
			assert.throws(() => ctx.runtime.executeTx(txGroup), RUNTIME_ERR1009);
		});
	});

	describe("Set permissions app_id in controller", function () {
		this.beforeAll(setUpCtx);

		let setPermissionsParams;
		this.beforeEach(() => {
			const appArgs = ["str:set_permission", `int:${ctx.permissionsappID}`];
			setPermissionsParams = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: ctx.alice.account,
				appID: ctx.controllerappID,
				payFlags: { totalFee: 1000 },
				appArgs: appArgs,
				foreignAssets: [ctx.assetIndex],
			};
		});

		// note: in current version controller.manager == asa.manager
		it("should reject if sender of controller is not asa.manager", () => {
			// verify first elon is not asset manager
			assert.notEqual(asaManager.address, ctx.elon.address);

			setPermissionsParams.fromAccount = ctx.elon.account;
			assert.throws(() => ctx.runtime.executeTx([setPermissionsParams]), RUNTIME_ERR1009);
		});

		it("should reject if application args are incorrect", () => {
			setPermissionsParams.appArgs = ["str:set_Permission", `int:${ctx.permissionsappID}`];
			assert.throws(() => ctx.runtime.executeTx([setPermissionsParams]), RUNTIME_ERR1009);
		});

		/*
		 * Important test: here we deploy a new asset(with same manager as the original one),
		 * but since token index will be different, tx is rejected. Means that we cannot bypass
		 * the contract even if manager (OR other asset params) are same as the original. */
		it("should reject if asset index is incorrect even if manager is same", () => {
			// deploy new asset with same manager(alice) as original one
			const newAssetId = ctx.runtime.deployASA("tesla", {
				creator: { ...ctx.alice.account, name: "alice" },
			}).assetIndex;

			setPermissionsParams.foreignAssets = [newAssetId];
			assert.throws(() => ctx.runtime.executeTx([setPermissionsParams]), RUNTIME_ERR1009);
		});
	});
});
