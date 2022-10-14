import { types } from "@algo-builder/web";
import { getApplicationAddress } from "algosdk";
import { assert } from "chai";

import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { AccountStore, Runtime } from "../../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../../src/lib/constants";
import { AccountStoreI } from "../../../src/types";
import { useFixture } from "../../helpers/integration";
import { expectRuntimeError } from "../../helpers/runtime-errors";

describe("Algorand Smart Contracts(TEALv5) - Inner Transactions[ALGO Payment]", function () {
	useFixture("inner-transaction");
	const fee = 1000;
	const minBalance = ALGORAND_ACCOUNT_MIN_BALANCE * 10 + fee;
	const master = new AccountStore(300e6);
	let john = new AccountStore(minBalance + fee);
	let elon = new AccountStore(minBalance + fee);
	let bob = new AccountStore(minBalance + fee);
	let appAccount: AccountStoreI; // initialized later

	let runtime: Runtime;
	let approvalProgramFilename: string;
	let clearProgramFilename: string;
	let appDefinition: types.AppDefinitionFromFile;
	let appID: number;
	let appCallParams: types.ExecParams;
	this.beforeAll(function () {
		approvalProgramFilename = "approval-payment.py";
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
		runtime = new Runtime([master, john, elon, bob]); // setup test
		appID = runtime.deployApp(john.account, appDefinition, {}).appID;
		appAccount = runtime.getAccount(getApplicationAddress(appID)); // update app account

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

	it("initiate payment from smart contract", function () {
		const appAccountBalBefore = appAccount.balance();
		const johnBalBefore = john.balance();
		const elonBalBefore = elon.balance();

		// contracts pays 1ALGO to sender, and 2Algo's to txn.accounts[1]
		const paymentTxParams = {
			...appCallParams,
			appArgs: ["str:pay"],
			accounts: [elon.address],
		};
		runtime.executeTx([paymentTxParams]);
		syncAccounts();

		assert.equal(john.balance(), johnBalBefore + BigInt(1e6) - 1000n);
		assert.equal(elon.balance(), elonBalBefore + BigInt(2e6));
		assert.equal(appAccount.balance(), appAccountBalBefore - BigInt(3e6) - 2000n);
	});

	it("initiate payment from smart contract with fee set in inner txn", function () {
		const appAccountBalBefore = appAccount.balance();
		const elonBalBefore = elon.balance();

		// contracts pays 3 Algo's to txn.accounts[1]
		const paymentTxParams = {
			...appCallParams,
			appArgs: ["str:pay_with_fee"],
			accounts: [elon.address],
		};
		runtime.executeTx([paymentTxParams]);
		syncAccounts();

		assert.equal(elon.balance(), elonBalBefore + BigInt(3e6));
		assert.equal(appAccount.balance(), appAccountBalBefore - BigInt(3e6) - 1000n);
	});

	it("should fail on payment from smart contract if fee is 0", function () {
		const paymentTxParams = {
			...appCallParams,
			appArgs: ["str:pay_with_zero_fee"],
			accounts: [elon.address],
			payFlags: { totalFee: 1000 }, // not enough fees for inner txn
		};
		expectRuntimeError(
			() => runtime.executeTx([paymentTxParams]),
			RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH
		);
	});

	it("initiate payment from smart contract if inner txn fee is 0, but pooled fees cover it", function () {
		const appAccountBalBefore = appAccount.balance();
		const johnBalBefore = john.balance();
		const elonBalBefore = elon.balance();

		// contracts pays 3 Algo's to txn.accounts[1]
		const paymentTxParams = {
			...appCallParams,
			appArgs: ["str:pay_with_zero_fee"],
			accounts: [elon.address],
			payFlags: { totalFee: 1000 + 1000 }, // enough fees for base txn & inner txn
		};
		runtime.executeTx([paymentTxParams]);
		syncAccounts();

		assert.equal(elon.balance(), elonBalBefore + BigInt(3e6));
		// note that fees is not deducted from app account
		assert.equal(appAccount.balance(), appAccountBalBefore - BigInt(3e6));
		// total fees is deducted from Txn.sender()
		assert.equal(john.balance(), johnBalBefore - 2000n);
	});

	it("should not deduct fee from contract if enough fee available in pool", function () {
		const appAccountBalBefore = appAccount.balance();

		// same as prev test, just increasing totalFee
		const paymentTxParams = {
			...appCallParams,
			payFlags: { totalFee: 3000 }, // john can support upto 3 txns
			appArgs: ["str:pay"],
			accounts: [elon.address],
		};
		runtime.executeTx([paymentTxParams]);
		syncAccounts();

		// note that only 3ALGO are deducted (and not fees)
		assert.equal(appAccount.balance(), appAccountBalBefore - BigInt(3e6));
	});

	it("empty contract's account to txn.accounts[1] if close remainder to is passed", function () {
		const appAccountBalBefore = appAccount.balance();
		const bobBalBefore = bob.balance();
		assert.isAbove(Number(appAccountBalBefore), 0);

		// empties contract's ALGO's to elon (after deducting fees)
		const paymentTxParams = {
			...appCallParams,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:pay_with_close_rem_to"],
			accounts: [bob.address],
		};
		runtime.executeTx([paymentTxParams]);
		syncAccounts();

		assert.equal(appAccount.balance(), 0n);
		assert.equal(bob.balance(), bobBalBefore + appAccountBalBefore - 1000n);
	});
});
