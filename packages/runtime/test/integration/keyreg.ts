import { types } from "@algo-builder/web";
import { assert } from "chai";

import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { BaseTxnReceipt } from "../../src/types";
import * as testdata from "../helpers/data";
import { useFixture } from "../helpers/integration";

const minBalance = BigInt(ALGORAND_ACCOUNT_MIN_BALANCE + 5000);
describe("Key Registration transaction", function () {
	useFixture("basic-teal");
	let john: AccountStore;
	let bob: AccountStore;
	let runtime: Runtime;

	const vKey = testdata.key1;
	const sKey = testdata.key2;

	this.beforeAll(async function () {
		john = new AccountStore(minBalance);
		bob = new AccountStore(minBalance);
		runtime = new Runtime([john, bob]);
	});

	// helper function
	function syncAccounts(): void {
		john = runtime.getAccount(john.address);
		bob = runtime.getAccount(bob.address);
	}

	it("should do noop on keyreg tx (secret key)", function () {
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
		const r = runtime.executeTx([txSKParams])[0] as BaseTxnReceipt;
		assert.isDefined(r);
		assert.isDefined(r.txn);
		assert.isDefined(r.txID);
		syncAccounts();
	});

	it("should do noop on keyreg tx (logic sig)", function () {
		const lsig = runtime.loadLogic("basic.teal");
		lsig.sign(john.account.sk);

		const txLsigParams: types.KeyRegistrationParam = {
			type: types.TransactionType.KeyRegistration, // payment
			sign: types.SignType.LogicSignature,
			fromAccountAddr: john.account.addr,
			voteKey: vKey,
			selectionKey: sKey,
			voteFirst: 43,
			voteLast: 1000,
			voteKeyDilution: 5,
			lsig: lsig,
			payFlags: { totalFee: 1000 },
		};

		const r = runtime.executeTx([txLsigParams])[0] as BaseTxnReceipt;
		assert.isDefined(r);
		assert.isDefined(r.txn);
		assert.isDefined(r.txID);
		syncAccounts();
	});
});
