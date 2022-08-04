import { types } from "@algo-builder/web";
import { ExecParams, SignType, TransactionType } from "@algo-builder/web/build/types";
import algosdk, { LogicSigAccount } from "algosdk";
import { assert } from "chai";
import sinon from "sinon";

import { getProgram } from "../../src";
import { AccountStore } from "../../src/account";
import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { ASSET_CREATION_FEE } from "../../src/lib/constants";
import { mockSuggestedParams } from "../../src/mock/tx";
import { Runtime } from "../../src/runtime";
import { AccountStoreI } from "../../src/types";
import { useFixture } from "../helpers/integration";
import { expectRuntimeError } from "../helpers/runtime-errors";
import { elonMuskAccount } from "../mocks/account";

const programName = "basic.teal";
const basicFixture = "basic-teal";
const minBalance = BigInt(1e7);

describe("Transfer Algo Transaction", function () {
	const amount = minBalance;
	const fee = 1000;

	let alice: AccountStoreI;
	let bob: AccountStoreI;
	let alan: AccountStoreI;

	let runtime: Runtime;

	function syncAccounts(): void {
		alice = runtime.getAccount(alice.address);
		bob = runtime.getAccount(bob.address);
		alan = runtime.getAccount(alan.address);
	}

	this.beforeEach(() => {
		alice = new AccountStore(minBalance * 10n);
		bob = new AccountStore(minBalance * 10n);
		alan = new AccountStore(minBalance * 10n);
		runtime = new Runtime([alice, bob, alan]);
	});

	it("Transfer ALGO from alice to bob", () => {
		const initialAliceBalance = alice.balance();
		const initialBobBalance = bob.balance();

		const algoTransferTxParam: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: bob.address,
			amountMicroAlgos: amount,
			payFlags: {
				totalFee: fee,
			},
		};

		runtime.executeTx([algoTransferTxParam]);
		syncAccounts();

		assert.equal(initialAliceBalance, alice.balance() + BigInt(amount) + BigInt(fee));
		assert.equal(initialBobBalance + BigInt(amount), bob.balance());
	});

	it("close alice acount to bob", () => {
		const initialAliceBalance = alice.balance();
		const initialBobBalance = bob.balance();

		const algoTransferTxParam: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: bob.address,
			amountMicroAlgos: 0n,
			payFlags: {
				totalFee: fee,
				closeRemainderTo: bob.address,
			},
		};

		runtime.executeTx([algoTransferTxParam]);

		syncAccounts();
		assert.equal(alice.balance(), 0n);
		assert.equal(initialAliceBalance + initialBobBalance - BigInt(fee), bob.balance());
	});

	it("should ignore rekey when use with closeRemainderTo", () => {
		const initialAliceBalance = alice.balance();
		const initialBobBalance = bob.balance();

		const algoTransferTxParam: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: bob.address,
			amountMicroAlgos: 0n,
			payFlags: {
				totalFee: fee,
				closeRemainderTo: bob.address,
				rekeyTo: alan.address,
			},
		};

		runtime.executeTx([algoTransferTxParam]);

		syncAccounts();
		assert.equal(alice.balance(), 0n);
		assert.equal(initialAliceBalance + initialBobBalance - BigInt(fee), bob.balance());
		// spend/auth address of alice not changed.
		assert.equal(alice.getSpendAddress(), alice.address);
	});

	it("should throw error if closeRemainderTo is fromAccountAddr", () => {
		// throw error because closeReaminderTo invalid.
		expectRuntimeError(
			() =>
				runtime.executeTx([
					{
						type: types.TransactionType.TransferAlgo,
						sign: types.SignType.SecretKey,
						fromAccount: alice.account,
						toAccountAddr: bob.address,
						amountMicroAlgos: 0n,
						payFlags: {
							totalFee: fee,
							closeRemainderTo: alice.address,
						},
					},
				]),
			RUNTIME_ERRORS.TRANSACTION.INVALID_CLOSE_REMAINDER_TO
		);
	});

	describe("Transfer algo to implicit account", function () {
		let externalRuntimeAccount: AccountStoreI;
		let externalAccount: algosdk.Account;
		this.beforeEach(function () {
			externalAccount = new AccountStore(0).account;

			const transferAlgoTx: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				toAccountAddr: externalAccount.addr,
				amountMicroAlgos: amount,
				payFlags: {
					totalFee: 1000,
				},
			};

			runtime.executeTx([transferAlgoTx]);
			// query new external account in runtime.
			externalRuntimeAccount = runtime.getAccount(externalAccount.addr);
		});

		it("Balance of toAccountAddr should updated", () => {
			assert.equal(externalRuntimeAccount.amount, amount);
		});

		it("Should transfer algo to an external account", () => {
			const transferAlgoTx: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				toAccountAddr: externalRuntimeAccount.account.addr,
				amountMicroAlgos: 1000n,
				payFlags: {
					totalFee: 1000,
				},
			};

			assert.doesNotThrow(() => runtime.executeTx([transferAlgoTx]));
		});
	});
});

describe("Logic Signature Transaction in Runtime", function () {
	useFixture(basicFixture);
	const john = new AccountStore(minBalance);
	const bob = new AccountStore(minBalance);
	const alice = new AccountStore(minBalance);

	let runtime: Runtime;
	let lsig: LogicSigAccount;
	let txParam: types.ExecParams;
	this.beforeAll(function () {
		runtime = new Runtime([john, bob, alice]);
		lsig = runtime.loadLogic(programName);
		txParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: john.account.addr,
			toAccountAddr: bob.account.addr,
			amountMicroAlgos: 1000n,
			lsig: lsig,
			payFlags: { totalFee: 1000 },
		};
	});

	it("should execute the lsig and verify john(delegated signature)", () => {
		lsig.sign(john.account.sk);
		runtime.executeTx([txParam]);

		// balance should be updated because logic is verified and accepted
		const bobAcc = runtime.getAccount(bob.address);
		assert.equal(bobAcc.balance(), minBalance + 1000n);
	});

	it("should not verify signature because alice sent it", () => {
		const invalidParams: types.ExecParams = {
			...txParam,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: alice.account.addr,
			lsig: lsig,
		};

		// execute transaction (logic signature validation failed)
		expectRuntimeError(
			() => runtime.executeTx([invalidParams]),
			RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_VALIDATION_FAILED
		);
	});

	it("should verify signature but reject logic", async () => {
		const logicSig = runtime.loadLogic("reject.teal");
		const txParams: types.ExecParams = {
			...txParam,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: john.account.addr,
			lsig: logicSig,
		};

		logicSig.sign(john.account.sk);
		// execute transaction (rejected by logic)
		// - Signature successfully validated for john
		// - But teal file logic is rejected
		expectRuntimeError(
			() => runtime.executeTx([txParams]),
			RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
		);
	});
});

describe("Rounds Test", function () {
	useFixture(basicFixture);
	let john = new AccountStore(minBalance);
	let bob = new AccountStore(minBalance);
	let runtime: Runtime;
	let txParams: types.AlgoTransferParam;
	this.beforeAll(function () {
		runtime = new Runtime([john, bob]); // setup test

		// set up transaction paramenters
		txParams = {
			type: types.TransactionType.TransferAlgo, // payment
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			toAccountAddr: bob.address,
			amountMicroAlgos: 100n,
			payFlags: { firstValid: 5, validRounds: 200, totalFee: 1000 },
		};
	});

	afterEach(function () {
		john = new AccountStore(minBalance);
		bob = new AccountStore(minBalance);
		runtime = new Runtime([john, bob]);
		txParams = {
			...txParams,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			toAccountAddr: bob.address,
		};
	});

	function syncAccounts(): void {
		john = runtime.getAccount(john.address);
		bob = runtime.getAccount(bob.address);
	}

	it("should succeed if current round is between first and last valid", () => {
		txParams.payFlags = { totalFee: 1000, firstValid: 5, validRounds: 200 };
		runtime.setRoundAndTimestamp(20, 20);

		runtime.executeTx([txParams]);

		// get final state (updated accounts)
		syncAccounts();
		assert.equal(john.balance(), minBalance - 1100n);
		assert.equal(bob.balance(), minBalance + 100n);
	});

	it("should fail if current round is not between first and last valid", () => {
		runtime.setRoundAndTimestamp(3, 20);

		expectRuntimeError(
			() => runtime.executeTx([txParams]),
			RUNTIME_ERRORS.GENERAL.INVALID_ROUND
		);
	});

	it("should succeeded by default (no round requirement is passed)", () => {
		txParams.payFlags = { totalFee: 1000 };

		runtime.executeTx([txParams]);

		// get final state (updated accounts)
		syncAccounts();
		assert.equal(john.balance(), minBalance - 1100n);
		assert.equal(bob.balance(), minBalance + 100n);
	});
});

describe("Send duplicate transaction", function () {
	const amount = minBalance;
	const fee = 1000;

	let alice: AccountStoreI;
	let bob: AccountStoreI;

	let runtime: Runtime;
	let paymentTxn: types.AlgoTransferParam;

	this.beforeEach(() => {
		runtime = new Runtime([]);
		[alice, bob] = runtime.defaultAccounts();
		paymentTxn = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: bob.address,
			amountMicroAlgos: amount,
			payFlags: {
				totalFee: fee,
			},
		};
	});

	it("Should throw an error when sending duplicate tx in a group", () => {
		const groupTx = [paymentTxn, { ...paymentTxn }];

		expectRuntimeError(
			() => runtime.executeTx(groupTx),
			RUNTIME_ERRORS.TRANSACTION.TRANSACTION_ALREADY_IN_LEDGER
		);
	});

	it("Should not throw an error when add different note filed", () => {
		const groupTx = [paymentTxn, { ...paymentTxn, payFlags: { note: "salt" } }];

		assert.doesNotThrow(() => runtime.executeTx(groupTx));
	});
});

describe("Algorand Standard Assets", function () {
	useFixture("asa-check");
	let john = new AccountStore(minBalance);
	const bob = new AccountStore(minBalance);
	let alice = new AccountStore(minBalance);
	const elon = new AccountStore(minBalance, elonMuskAccount);
	let runtime: Runtime;
	let modFields: types.AssetModFields;
	let assetTransferParam: types.AssetTransferParam;
	let assetId: number;
	this.beforeAll(() => {
		runtime = new Runtime([john, bob, alice, elon]);
		modFields = {
			manager: bob.address,
			reserve: bob.address,
			clawback: john.address,
			freeze: john.address,
		};
		assetTransferParam = {
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			toAccountAddr: alice.account.addr,
			amount: 10n,
			assetID: 1,
			payFlags: { totalFee: 1000 },
		};
	});

	this.beforeEach(() => {
		assetId = runtime.deployASA("gold", {
			creator: { ...john.account, name: "john" },
		}).assetIndex;
		assetTransferParam.assetID = assetId;
		syncAccounts();
	});

	const syncAccounts = (): void => {
		john = runtime.getAccount(john.address);
		alice = runtime.getAccount(alice.address);
	};

	it("should create asset using asa.yaml file and raise account minimum balance", () => {
		const initialMinBalance = john.minBalance;
		assetId = runtime.deployASA("gold", {
			creator: { ...john.account, name: "john" },
		}).assetIndex;
		syncAccounts();

		const res = runtime.getAssetDef(assetId);
		assert.equal(res.decimals, 0);
		assert.equal(res.defaultFrozen, false);
		assert.equal(res.total, 5912599999515n);
		assert.deepEqual(
			res.metadataHash,
			new Uint8Array(Buffer.from("12312442142141241244444411111133", "base64"))
		);
		assert.equal(res.unitName, "GLD");
		assert.equal(res.url, "url");
		assert.equal(res.manager, elon.address);
		assert.equal(res.reserve, elon.address);
		assert.equal(res.freeze, elon.address);
		assert.equal(res.clawback, elon.address);
		assert.equal(john.minBalance, initialMinBalance + ASSET_CREATION_FEE);
	});

	it("should create asset without using asa.yaml file", () => {
		const expected = {
			name: "gold-1221",
			asaDef: {
				total: 10000,
				decimals: 0,
				defaultFrozen: false,
				unitName: "SLV",
				url: "url",
				metadataHash: "12312442142141241244444411111133",
				note: "note",
			},
		};
		assetId = runtime.deployASADef(expected.name, expected.asaDef, {
			creator: { ...john.account, name: "john" },
		}).assetIndex;
		syncAccounts();

		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);
		assert.equal(res.decimals, 0);
		assert.equal(res.defaultFrozen, false);
		assert.equal(res.total, 10000n);
		assert.deepEqual(
			res.metadataHash,
			new Uint8Array(Buffer.from("12312442142141241244444411111133", "base64"))
		);
		assert.equal(res.unitName, "SLV");
		assert.equal(res.url, "url");
	});

	it("should create asset without using asa.yaml (execute transaction)", () => {
		const execParams: types.ExecParams = {
			type: types.TransactionType.DeployASA,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			asaName: "silver-12",
			asaDef: {
				total: 10000,
				decimals: 0,
				defaultFrozen: false,
				unitName: "SLV",
				url: "url",
				metadataHash: "12312442142141241244444411111133",
				note: "note",
			},
			payFlags: {},
		};
		runtime.executeTx([execParams]);
		syncAccounts();

		const res = runtime.getAssetInfoFromName("silver-12");
		assert.isDefined(res);
		assert.equal(res?.assetDef.decimals, 0);
		assert.equal(res?.assetDef.defaultFrozen, false);
		assert.equal(res?.assetDef.total, 10000n);
		assert.deepEqual(
			res?.assetDef.metadataHash,
			new Uint8Array(Buffer.from("12312442142141241244444411111133", "base64"))
		);
		assert.equal(res?.assetDef.unitName, "SLV");
		assert.equal(res?.assetDef.url, "url");
	});

	it("should opt-in to asset", () => {
		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);

		const johnAssetHolding = john.getAssetHolding(assetId);
		assert.isDefined(johnAssetHolding);
		assert.equal(johnAssetHolding?.amount, 5912599999515n);

		// opt-in for alice
		runtime.optInToASA(assetId, alice.address, {});
		const aliceAssetHolding = alice.getAssetHolding(assetId);
		assert.isDefined(aliceAssetHolding);
		assert.equal(aliceAssetHolding?.amount, 0n);
	});

	it("should opt-in to asset using asset transfer transaction", () => {
		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);
		const prevAliceMinBal = alice.minBalance;

		// opt-in for alice (using asset transfer tx with amount == 0)
		const optInParams: types.ExecParams = {
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: alice.address,
			amount: 0n,
			assetID: assetId,
			payFlags: { totalFee: 1000 },
		};
		runtime.executeTx([optInParams]);
		syncAccounts();

		const aliceAssetHolding = alice.getAssetHolding(assetId);
		assert.equal(aliceAssetHolding?.amount, 0n);
		// verfiy min balance is also raised
		assert.equal(alice.minBalance, prevAliceMinBal + ASSET_CREATION_FEE);
	});

	it("should throw error on opt-in if asset does not exist", () => {
		expectRuntimeError(
			() => runtime.optInToASA(1234, john.address, {}),
			RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND
		);
	});

	it("should warn if account already is already opted-into asset", () => {
		// console is mocked in package.json mocha options
		const stub = console.warn as sinon.SinonStub;
		stub.reset();

		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);

		// executing same opt-in tx again
		runtime.optInToASA(assetId, john.address, {});
		assert(stub.calledWith(`${john.address} is already opted in to asset ${assetId}`));
	});

	it("should transfer asset between two accounts", () => {
		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);
		runtime.optInToASA(assetId, alice.address, {});

		const initialJohnAssets = john.getAssetHolding(assetId)?.amount;
		const initialAliceAssets = alice.getAssetHolding(assetId)?.amount;
		assert.isDefined(initialJohnAssets);
		assert.isDefined(initialAliceAssets);

		assetTransferParam.amount = 100n;
		runtime.executeTx([assetTransferParam]);
		syncAccounts();

		if (initialJohnAssets && initialAliceAssets) {
			assert.equal(john.getAssetHolding(assetId)?.amount, initialJohnAssets - 100n);
			assert.equal(alice.getAssetHolding(assetId)?.amount, initialAliceAssets + 100n);
		}
	});

	it("should throw error on transfer asset if asset is frozen and amount > 0", () => {
		const freezeParam: types.FreezeAssetParam = {
			type: types.TransactionType.FreezeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			assetID: assetId,
			freezeTarget: john.address,
			freezeState: true,
			payFlags: { flatFee: true, totalFee: 1000 },
		};

		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);
		runtime.optInToASA(assetId, alice.address, {});
		// freezing asset holding for john
		runtime.executeTx([freezeParam]);

		expectRuntimeError(
			() => runtime.executeTx([assetTransferParam]),
			RUNTIME_ERRORS.TRANSACTION.ACCOUNT_ASSET_FROZEN
		);

		assetTransferParam.amount = 0n;
		assert.doesNotThrow(
			() => runtime.executeTx([assetTransferParam]), // should pass successfully
			`RUNTIME_ERR1505: Asset index 7 frozen for account ${john.address}`
		);
	});

	it("should close alice account for transfer asset if close remainder to is specified", () => {
		const initialAliceMinBalance = alice.minBalance;
		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);
		runtime.optInToASA(assetId, alice.address, {});

		// transfer few assets to alice
		runtime.executeTx([
			{
				...assetTransferParam,
				toAccountAddr: alice.address,
				amount: 30n,
			},
		]);

		syncAccounts();
		assert.equal(alice.minBalance, initialAliceMinBalance + ASSET_CREATION_FEE); // alice min balance raised after opt-in
		const initialJohnAssets = john.getAssetHolding(assetId)?.amount;
		const initialAliceAssets = alice.getAssetHolding(assetId)?.amount;
		assert.isDefined(initialJohnAssets);
		assert.isDefined(initialAliceAssets);

		runtime.executeTx([
			{
				...assetTransferParam,
				sign: types.SignType.SecretKey,
				fromAccount: alice.account,
				toAccountAddr: alice.address,
				payFlags: { totalFee: 1000, closeRemainderTo: john.address }, // transfer all assets of alice => john (using closeRemTo)
			},
		]);
		syncAccounts();

		assert.isUndefined(alice.getAssetHolding(assetId));
		if (initialJohnAssets && initialAliceAssets) {
			assert.equal(
				john.getAssetHolding(assetId)?.amount,
				initialJohnAssets + initialAliceAssets
			);
			assert.equal(alice.minBalance, initialAliceMinBalance); // min balance should decrease to initial value after opt-out
		}
	});

	it("should throw error if closeRemainderTo is fromAccountAddr", () => {
		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);
		runtime.optInToASA(assetId, alice.address, {});

		// transfer few assets to alice
		runtime.executeTx([
			{
				...assetTransferParam,
				toAccountAddr: alice.address,
				amount: 30n,
			},
		]);

		// throw error because closeReaminderTo invalid.
		expectRuntimeError(
			() =>
				runtime.executeTx([
					{
						...assetTransferParam,
						sign: types.SignType.SecretKey,
						fromAccount: alice.account,
						toAccountAddr: alice.address,
						payFlags: { totalFee: 1000, closeRemainderTo: alice.address }, // transfer all assets of alice => john (using closeRemTo)
					},
				]),
			RUNTIME_ERRORS.TRANSACTION.INVALID_CLOSE_REMAINDER_TO
		);
	});

	it("should throw error if trying to close asset holding of asset creator account", () => {
		const res = runtime.getAssetDef(assetId);
		assert.isDefined(res);
		runtime.optInToASA(assetId, alice.address, {});

		expectRuntimeError(
			() =>
				runtime.executeTx([
					{
						...assetTransferParam,
						payFlags: { totalFee: 1000, closeRemainderTo: alice.address }, // creator of ASA trying to close asset holding to alice
					},
				]),
			RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CREATOR
		);
	});

	it("should throw error if asset is not found while modifying", () => {
		const modifyParam: types.ModifyAssetParam = {
			type: types.TransactionType.ModifyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: john.account,
			assetID: 120,
			fields: modFields,
			payFlags: {},
		};
		expectRuntimeError(
			() => runtime.executeTx([modifyParam]),
			RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND
		);
	});

	it("should modify asset", () => {
		const modifyParam: types.ModifyAssetParam = {
			type: types.TransactionType.ModifyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			assetID: assetId,
			fields: modFields,
			payFlags: {},
		};
		runtime.executeTx([modifyParam]);

		const res = runtime.getAssetDef(assetId);
		assert.equal(res.manager, bob.address);
		assert.equal(res.reserve, bob.address);
		assert.equal(res.clawback, john.address);
		assert.equal(res.freeze, john.address);
	});

	it("Blank field test, should not modify asset because field is set to blank", () => {
		const assetId = runtime.deployASA("silver", {
			creator: { ...john.account, name: "john" },
		}).assetIndex;

		const modFields: types.AssetModFields = {
			manager: bob.address,
			reserve: bob.address,
			clawback: john.address,
			freeze: alice.address,
		};
		const modifyParam: types.ModifyAssetParam = {
			type: types.TransactionType.ModifyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			assetID: assetId,
			fields: modFields,
			payFlags: {},
		};

		expectRuntimeError(
			() => runtime.executeTx([modifyParam]),
			RUNTIME_ERRORS.ASA.BLANK_ADDRESS_ERROR
		);
	});

	it("should fail because only manager account can modify asset", () => {
		const modifyParam: types.ModifyAssetParam = {
			type: types.TransactionType.ModifyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: bob.account,
			assetID: assetId,
			fields: modFields,
			payFlags: {},
		};
		expectRuntimeError(
			() => runtime.executeTx([modifyParam]),
			RUNTIME_ERRORS.ASA.MANAGER_ERROR
		);
	});

	it("should fail because only freeze account can freeze asset", () => {
		const freezeParam: types.FreezeAssetParam = {
			type: types.TransactionType.FreezeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: bob.account,
			assetID: assetId,
			freezeTarget: john.address,
			freezeState: true,
			payFlags: {},
		};

		expectRuntimeError(() => runtime.executeTx([freezeParam]), RUNTIME_ERRORS.ASA.FREEZE_ERROR);
	});

	it("should freeze asset", () => {
		const freezeParam: types.FreezeAssetParam = {
			type: types.TransactionType.FreezeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			assetID: assetId,
			freezeTarget: john.address,
			freezeState: true,
			payFlags: {},
		};
		runtime.executeTx([freezeParam]);

		const johnAssetHolding = runtime.getAssetHolding(assetId, john.address);
		assert.equal(johnAssetHolding["is-frozen"], true);
	});

	it("should fail because only clawback account can revoke assets", () => {
		const revokeParam: types.RevokeAssetParam = {
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			recipient: john.address,
			assetID: assetId,
			revocationTarget: bob.address,
			amount: 1n,
			payFlags: {},
		};
		expectRuntimeError(
			() => runtime.executeTx([revokeParam]),
			RUNTIME_ERRORS.ASA.CLAWBACK_ERROR
		);
	});

	it("should revoke assets", () => {
		const revokeParam: types.RevokeAssetParam = {
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			recipient: john.address,
			assetID: assetId,
			revocationTarget: bob.address,
			amount: 15n,
			payFlags: {},
		};
		runtime.optInToASA(assetId, bob.address, {});

		assetTransferParam.toAccountAddr = bob.address;
		assetTransferParam.amount = 20n;
		assetTransferParam.payFlags = {};

		runtime.executeTx([assetTransferParam]);

		let bobHolding = runtime.getAssetHolding(assetId, bob.address);
		const beforeRevokeJohn = runtime.getAssetHolding(assetId, john.address).amount;
		assert.equal(bobHolding.amount, assetTransferParam.amount);

		runtime.executeTx([revokeParam]);

		const johnHolding = runtime.getAssetHolding(assetId, john.address);
		bobHolding = runtime.getAssetHolding(assetId, bob.address);
		assert.equal(beforeRevokeJohn + 15n, johnHolding.amount);
		assert.equal(bobHolding.amount, 5n);
	});

	it("should fail because only clawback account can revoke assets", () => {
		const revokeParam: types.RevokeAssetParam = {
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			recipient: john.address,
			assetID: assetId,
			revocationTarget: bob.address,
			amount: 1n,
			payFlags: {},
		};
		expectRuntimeError(
			() => runtime.executeTx([revokeParam]),
			RUNTIME_ERRORS.ASA.CLAWBACK_ERROR
		);
	});

	it("should throw error if trying to close asset holding by clawback", () => {
		/* eslint sonarjs/no-identical-functions: "off" */
		const closebyClawbackParam: types.RevokeAssetParam = {
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			recipient: john.address,
			assetID: assetId,
			revocationTarget: john.address,
			amount: 0n,
			payFlags: { closeRemainderTo: alice.address }, // closing to alice using clawback
		};

		// opt-in to asset by alice
		runtime.optInToASA(assetId, alice.address, {});
		expectRuntimeError(
			() => runtime.executeTx([closebyClawbackParam]),
			RUNTIME_ERRORS.ASA.CANNOT_CLOSE_ASSET_BY_CLAWBACK
		);
	});

	it("should revoke if asset is frozen", () => {
		const freezeParam: types.FreezeAssetParam = {
			type: types.TransactionType.FreezeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			assetID: assetId,
			freezeTarget: bob.address,
			freezeState: true,
			payFlags: {},
		};
		const revokeParam: types.RevokeAssetParam = {
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			recipient: john.address,
			assetID: assetId,
			revocationTarget: bob.address,
			amount: 15n,
			payFlags: {},
		};
		runtime.optInToASA(assetId, bob.address, {});

		assetTransferParam.toAccountAddr = bob.address;
		assetTransferParam.amount = 20n;
		assetTransferParam.payFlags = {};
		runtime.executeTx([assetTransferParam]);
		runtime.executeTx([freezeParam]);
		let bobHolding = runtime.getAssetHolding(assetId, bob.address);
		const beforeRevokeJohn = runtime.getAssetHolding(assetId, john.address).amount;
		assert.equal(bobHolding.amount, assetTransferParam.amount);

		runtime.executeTx([revokeParam]);

		const johnHolding = runtime.getAssetHolding(assetId, john.address);
		bobHolding = runtime.getAssetHolding(assetId, bob.address);
		assert.equal(beforeRevokeJohn + 15n, johnHolding.amount);
		assert.equal(bobHolding.amount, 5n);
	});

	it("Should fail because only manager can destroy assets", () => {
		const destroyParam: types.DestroyAssetParam = {
			type: types.TransactionType.DestroyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			assetID: assetId,
			payFlags: {},
		};
		expectRuntimeError(
			() => runtime.executeTx([destroyParam]),
			RUNTIME_ERRORS.ASA.MANAGER_ERROR
		);
	});

	it("Should destroy asset", () => {
		const initialCreatorMinBalance = john.minBalance;
		const destroyParam: types.DestroyAssetParam = {
			type: types.TransactionType.DestroyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			assetID: assetId,
			payFlags: {},
		};

		runtime.executeTx([destroyParam]);
		syncAccounts();

		expectRuntimeError(() => runtime.getAssetDef(assetId), RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND);
		// verify min balance of creator decreased after deleting app (by asa.manager)
		assert.equal(john.minBalance, initialCreatorMinBalance - ASSET_CREATION_FEE);
	});

	it("Should not destroy asset if total assets are not in creator's account", () => {
		const destroyParam: types.DestroyAssetParam = {
			type: types.TransactionType.DestroyAsset,
			sign: types.SignType.SecretKey,
			fromAccount: elon.account,
			assetID: assetId,
			payFlags: {},
		};
		runtime.optInToASA(assetId, bob.address, {});

		assetTransferParam.toAccountAddr = bob.address;
		assetTransferParam.amount = 20n;
		assetTransferParam.payFlags = {};
		runtime.executeTx([assetTransferParam]);

		expectRuntimeError(
			() => runtime.executeTx([destroyParam]),
			RUNTIME_ERRORS.ASA.ASSET_TOTAL_ERROR
		);
	});
});

describe("Stateful Smart Contracts", function () {
	useFixture("stateful");
	const john = new AccountStore(minBalance);
	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let appDefinition: types.AppDefinitionFromFile;
	this.beforeEach(() => {
		runtime = new Runtime([john]);
		approvalProgramFilename = "counter-approval.teal";
		clearProgramFilename = "clear.teal";

		appDefinition = {
			appName: "app",
			metaType: types.MetaType.FILE,
			approvalProgramFilename,
			clearProgramFilename,
			globalBytes: 32,
			globalInts: 32,
			localBytes: 8,
			localInts: 8,
		};
	});

	it("Should not create application if approval program is empty", () => {
		appDefinition.approvalProgramFilename = "empty-app.teal";

		expectRuntimeError(
			() => runtime.deployApp(john.account, appDefinition, {}),
			RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM
		);
	});

	it("Should not create application if clear program is empty", () => {
		appDefinition.clearProgramFilename = "empty-app.teal";

		expectRuntimeError(
			() => runtime.deployApp(john.account, appDefinition, {}),
			RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM
		);
	});

	it("Should create application", () => {
		const appID = runtime.deployApp(john.account, appDefinition, {}).appID;

		const app = runtime.getApp(appID);
		assert.isDefined(app);
	});

	it("Should throw error when deploy application if approval teal version and clear state teal version not match ", () => {
		appDefinition.clearProgramFilename = "clearv6.teal";
		expectRuntimeError(
			() => runtime.deployApp(john.account, appDefinition, {}),
			RUNTIME_ERRORS.TEAL.PROGRAM_VERSION_MISMATCH
		);
	});

	it("Should not update application if approval or clear program is empty", () => {
		const appID = runtime.deployApp(john.account, appDefinition, {}).appID;

		expectRuntimeError(
			() =>
				runtime.updateApp(
					appDefinition.appName,
					john.address,
					appID,
					{
						metaType: types.MetaType.SOURCE_CODE,
						approvalProgramCode: "",
						clearProgramCode: getProgram(clearProgramFilename),
					},
					{},
					{}
				),
			RUNTIME_ERRORS.GENERAL.INVALID_APPROVAL_PROGRAM
		);

		expectRuntimeError(
			() =>
				runtime.updateApp(
					appDefinition.appName,
					john.address,
					appID,
					{
						metaType: types.MetaType.SOURCE_CODE,
						approvalProgramCode: getProgram(approvalProgramFilename),
						clearProgramCode: "",
					},
					{},
					{}
				),
			RUNTIME_ERRORS.GENERAL.INVALID_CLEAR_PROGRAM
		);
	});

	it("Should not update application if approval and clear program not match", () => {
		const appID = runtime.deployApp(john.account, appDefinition, {}).appID;

		clearProgramFilename = "clearv6.teal";
		expectRuntimeError(
			() =>
				runtime.updateApp(
					appDefinition.appName,
					john.address,
					appID,
					{
						metaType: types.MetaType.FILE,
						approvalProgramFilename,
						clearProgramFilename,
					},
					{},
					{}
				),
			RUNTIME_ERRORS.TEAL.PROGRAM_VERSION_MISMATCH
		);
	});

	it("Should throw and error when local schema entries exceeds the limit (AppDefinition)", () => {
		const incorrectCreationFlags = {
			globalBytes: 10,
			globalInts: 10,
			localBytes: 10,
			localInts: 10,
		};
		expectRuntimeError(
			() =>
				runtime.deployApp(
					john.account,
					{
						appName: "app",
						metaType: types.MetaType.FILE,
						approvalProgramFilename,
						clearProgramFilename,
						...incorrectCreationFlags,
					},
					{}
				),
			RUNTIME_ERRORS.GENERAL.MAX_SCHEMA_ENTRIES_EXCEEDED
		);
	});

	it("Should throw and error when global schema entries exceeds the limit (AppDefinition)", () => {
		const incorrectCreationFlags = {
			globalBytes: 36,
			globalInts: 32,
			localBytes: 1,
			localInts: 1,
		};
		expectRuntimeError(
			() =>
				runtime.deployApp(
					john.account,
					{
						appName: "app",
						metaType: types.MetaType.FILE,
						approvalProgramFilename,
						clearProgramFilename,
						...incorrectCreationFlags,
					},
					{}
				),
			RUNTIME_ERRORS.GENERAL.MAX_SCHEMA_ENTRIES_EXCEEDED
		);
	});
});

describe("Deafult Accounts", function () {
	let alice: AccountStore;
	let bob: AccountStore;
	let charlie = new AccountStore(minBalance);
	let runtime: Runtime;
	const amount = 1e6;
	const fee = 1000;

	function syncAccounts(): void {
		[alice, bob] = runtime.defaultAccounts();
		charlie = runtime.getAccount(charlie.address);
	}
	this.beforeEach(() => {
		runtime = new Runtime([charlie]);
		[alice, bob] = runtime.defaultAccounts();
	});

	it("Should be properly initialized", () => {
		assert.exists(alice.address);
		assert.equal(
			alice.balance(),
			BigInt(runtime.defaultBalance),
			"Alice balance must be correct"
		);
	});

	it("Should update the state of the default accounts", () => {
		const initialAliceBalance = alice.balance();
		const initialBobBalance = bob.balance();

		const algoTransferTxParam: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: bob.address,
			amountMicroAlgos: amount,
			payFlags: {
				totalFee: fee,
			},
		};

		runtime.executeTx([algoTransferTxParam]);

		syncAccounts();

		assert.equal(initialAliceBalance, alice.balance() + BigInt(amount) + BigInt(fee));
		assert.equal(initialBobBalance + BigInt(amount), bob.balance());
	});

	it("Should reset the state of the default accounts", () => {
		const initialAliceBalance = alice.balance();
		const initialBobBalance = bob.balance();

		const algoTransferTxParam: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: bob.address,
			amountMicroAlgos: amount,
			payFlags: {
				totalFee: fee,
			},
		};

		runtime.executeTx([algoTransferTxParam]);
		runtime.resetDefaultAccounts();
		syncAccounts();

		assert.equal(initialAliceBalance, alice.balance());
		assert.equal(initialBobBalance, bob.balance());
	});

	it("Should not reset the state of the other accounts stored in runtime", () => {
		const initialCharlieBalance = charlie.balance();
		const algoTransferTxParam: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			toAccountAddr: charlie.address,
			amountMicroAlgos: amount,
			payFlags: {
				totalFee: fee,
			},
		};
		runtime.executeTx([algoTransferTxParam]);
		runtime.resetDefaultAccounts();
		syncAccounts();

		assert.equal(initialCharlieBalance + BigInt(amount), charlie.balance());
	});
});

describe("Algo transfer using sendSignedTransaction", function () {
	let alice: AccountStore;
	let bob: AccountStore;
	let runtime: Runtime;
	const amount = 1e6;
	const fee = 1000;

	this.beforeEach(() => {
		runtime = new Runtime([]);
		[alice, bob] = runtime.defaultAccounts();
	});

	it("Should send signedTransacion from one account to another", () => {
		//Create transaction
		const initialAliceBalance = alice.balance();
		const initialBobBalance = bob.balance();
		const suggestedParams = mockSuggestedParams({ totalFee: fee }, runtime.getRound());
		const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
			from: alice.account.addr,
			to: bob.address,
			amount: amount,
			suggestedParams: suggestedParams,
		});
		// Sign the transaction
		const signedTransaction = algosdk.decodeSignedTransaction(txn.signTxn(alice.account.sk));
		// Send the transaction
		runtime.sendSignedTransaction(signedTransaction);
		[alice, bob] = runtime.defaultAccounts();
		assert.equal(initialAliceBalance, alice.balance() + BigInt(amount) + BigInt(fee));
		assert.equal(initialBobBalance + BigInt(amount), bob.balance()); //(got, expected)
	});

	it("Should close alice account and send all the balance to bob the account", () => {
		// Create transaction
		const initialAliceBalance = alice.balance();
		const initialBobBalance = bob.balance();
		console.log(initialAliceBalance);
		console.log(initialBobBalance);
		const suggestedParams = mockSuggestedParams({ totalFee: fee }, runtime.getRound());
		const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
			from: alice.account.addr,
			to: bob.address,
			amount: amount,
			suggestedParams: suggestedParams,
			closeRemainderTo: bob.address,
		});
		// Sign the transaction
		const signedTransaction = algosdk.decodeSignedTransaction(txn.signTxn(alice.account.sk));
		// Send the transaction
		runtime.sendSignedTransaction(signedTransaction);
		[alice, bob] = runtime.defaultAccounts();
		assert.equal(0n, alice.balance()); //(got, expected)
		assert.equal(initialBobBalance + initialAliceBalance - BigInt(fee), bob.balance());
		//-199999000n
		//+101000000n
	});
});
//enable this tests when the signature validation is ready
describe.skip("Logic Signature Transaction in Runtime using sendSignedTransaction", function () {
	useFixture(basicFixture);
	let alice: AccountStore;
	let bob: AccountStore;
	let john: AccountStore;
	let runtime: Runtime;
	const amount = 1e6;
	const fee = 1000;
	let lsig: LogicSigAccount;
	this.beforeEach(function () {
		runtime = new Runtime([]);
		[alice, bob, john] = runtime.defaultAccounts();
		lsig = runtime.loadLogic(programName);
		lsig.sign(john.account.sk);
	});

	it("should execute the lsig and verify john(delegated signature)", () => {
		const initialJohnBalance = john.balance();
		const initialBobBalance = bob.balance();
		const suggestedParams = mockSuggestedParams({ totalFee: fee }, runtime.getRound());
		const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
			from: john.address,
			to: bob.address,
			amount: amount,
			suggestedParams: suggestedParams,
		});
		// Sign the transaction
		const signedTransaction = algosdk.decodeSignedTransaction(
			algosdk.signLogicSigTransactionObject(txn, lsig).blob
		);
		// Send the transaction
		runtime.sendSignedTransaction(signedTransaction);
		[john, bob] = runtime.defaultAccounts();
		assert.equal(initialJohnBalance - BigInt(amount) - BigInt(fee), john.balance());
		assert.equal(initialBobBalance + BigInt(amount), bob.balance());
	});

	it("should not verify signature because alice sent it", () => {
		const suggestedParams = mockSuggestedParams({ totalFee: fee }, runtime.getRound());
		const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
			from: john.address,
			to: bob.address,
			amount: amount,
			suggestedParams: suggestedParams,
		});
		// Sign the transaction
		const signedTransaction = algosdk.decodeSignedTransaction(
			algosdk.signLogicSigTransactionObject(txn, lsig).blob
		);
		// Send the transaction
		expectRuntimeError(
			() => runtime.sendSignedTransaction(signedTransaction),
			RUNTIME_ERRORS.GENERAL.LOGIC_SIGNATURE_VALIDATION_FAILED
		);
	});
});
