import algosdk from "algosdk";
import { assert } from "chai";

import { Runtime } from "../../src";
import { mockSuggestedParams } from "../../src/mock/tx";
import { AccountStoreI } from "../../src/types";

describe.only("Guide examples", function () {
	let runtime: Runtime;
	let alice: AccountStoreI;
	let bob: AccountStoreI;
	const amount = 5000000; //5 algos
	const fee = 1000;
	this.beforeEach(function () {
		runtime = new Runtime([]);
		[alice, bob] = runtime.defaultAccounts();
	});

	it("Should send 5 algos from alice to bob", function () {
		//create the transaction
		const defaultBalance = alice.balance();
		const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
			from: alice.address,
			to: bob.address,
			amount: amount,
			note: undefined,
			suggestedParams: mockSuggestedParams({ totalFee: fee }, runtime.getRound()),
		});
		// sign it and decode it to signedTransaction object
		const signedTransacion = algosdk.decodeSignedTransaction(
			transaction.signTxn(alice.account.sk)
		);
		// submit the transaction
		const confirmedTxn = runtime.executeTx([signedTransacion]);
		//console.log(confirmedTxn);
		//sync the accounts with runtime
		[alice, bob] = runtime.defaultAccounts();
		//assert the balances are correct
		assert.equal(alice.balance(), defaultBalance - BigInt(fee) - BigInt(amount));
		assert.equal(bob.balance(), defaultBalance + BigInt(amount));
	});
});
