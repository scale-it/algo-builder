const { getProgram } = require("@algo-builder/runtime");
const { Runtime, AccountStore } = require("@algo-builder/runtime");
const { types } = require("@algo-builder/web");
const { assert } = require("chai");
const cfg = require("../algob.config");

const minBalance = BigInt(1e6);
const masterBalance = BigInt(10e6);
const amount = BigInt(1e6);

describe("Sample Test", function () {
	let master;
	let fundReceiver;

	let runtime;
	let lsig;
	const feeCheckProgram = getProgram("fee-check.teal");
	// Add a path to getProgram from another path instead of assets
	// const feeCheckProgram = getProgram("fee-check.teal", "../assets");

	this.beforeEach(async function () {
		master = new AccountStore(masterBalance);
		fundReceiver = new AccountStore(minBalance);
		runtime = new Runtime([master, fundReceiver]);

		lsig = runtime.createLsigAccount(feeCheckProgram);
		lsig.sign(master.account.sk);
	});

	function syncAccounts() {
		master = runtime.getAccount(master.address);
		fundReceiver = runtime.getAccount(fundReceiver.address);
	}

	it("Should not fail because txn fees is equal to or greater than 10000 microAlgos", function () {
		const validTxFee = 10000;
		assert.equal(fundReceiver.balance(), minBalance);
		assert.equal(master.balance(), masterBalance);

		// In case you want to get account from algob.config.js with network default
		// runtime.addAccounts(cfg.networks.default.accounts, 1000000);
		// console.log(runtime.getAccount(cfg.networks.default.accounts[0].addr));

		runtime.executeTx([
			{
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.LogicSignature,
				lsig: lsig,
				fromAccountAddr: master.address,
				toAccountAddr: fundReceiver.address,
				amountMicroAlgos: amount,
				payFlags: { totalFee: validTxFee },
			},
		]);
		syncAccounts();
		assert.equal(fundReceiver.balance(), minBalance + amount);
		assert.equal(master.balance(), masterBalance - amount - BigInt(validTxFee));
	});

	it("Should fail because txn fees is less than 10000 microAlgos", function () {
		const invalidTxFee = 1000;
		const initialFundRecBalance = fundReceiver.balance();
		const initialMasterBalance = master.balance();

		try {
			assert.throws(() =>
				runtime.executeTx([
					{
						type: types.TransactionType.TransferAlgo,
						sign: types.SignType.LogicSignature,
						lsig: lsig,
						fromAccountAddr: master.address,
						toAccountAddr: fundReceiver.address,
						amountMicroAlgos: amount,
						payFlags: { totalFee: invalidTxFee },
					},
				])
			);
		} catch (error) {
			console.log(error);
		}
		syncAccounts();
		// verify balance is unchanged
		assert.equal(fundReceiver.balance(), initialFundRecBalance);
		assert.equal(master.balance(), initialMasterBalance);
	});
});
