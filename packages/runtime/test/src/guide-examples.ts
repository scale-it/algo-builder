import { types } from "@algo-builder/web";
import algosdk, { SignedTransaction } from "algosdk";
import { assert } from "chai";

import { Runtime } from "../../src";
import { mockSuggestedParams } from "../../src/mock/tx";
import { AccountStoreI } from "../../src/types";

describe.only("Guide examples", function () {
	let runtime: Runtime;
	let alice: AccountStoreI;
	let bob: AccountStoreI;
	let charlie: AccountStoreI;
	let elon: AccountStoreI;
	const amount = 5000000; //5 algos
	const fee = 1000;
	let defaultBalance: bigint;
	this.beforeEach(function () {
		runtime = new Runtime([]);
		[alice, bob, charlie, elon] = runtime.defaultAccounts();
		defaultBalance = alice.balance();
	});

	it("Should send 5 algos from alice to bob", function () {
		//create the transaction
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
		//sync the accounts with runtime
		[alice, bob] = runtime.defaultAccounts();
		//assert the balances are correct
		assert.equal(alice.balance(), defaultBalance - BigInt(fee) - BigInt(amount));
		assert.equal(bob.balance(), defaultBalance + BigInt(amount));
	});
	it("Should send 5 algos from account rekeyed to multisig", function () {
		// create multisignature parameters
		const addrs = [bob.address, charlie.address];
		const multiSigParams = {
			version: 1,
			threshold: 2,
			addrs: addrs,
		};
		// create multisignature address
		const multSigAddr = algosdk.multisigAddress(multiSigParams);
		// rekey alice to multi sig
		const txParam: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice.account,
			fromAccountAddr: alice.address,
			toAccountAddr: alice.address,
			amountMicroAlgos: 0,
			payFlags: { totalFee: 1000, rekeyTo: multSigAddr },
		};
		runtime.executeTx([txParam]);
		// sync accounts
		[alice, bob, charlie, elon] = runtime.defaultAccounts();
		// create transaction using algosdk
		const txn = algosdk.makePaymentTxnWithSuggestedParams(
			alice.account.addr, // from
			elon.account.addr, // to
			5e6, // 5 algo
			undefined,
			undefined,
			mockSuggestedParams({ totalFee: fee }, runtime.getRound())
		);
		// Sign with first account
		const rawSignedTxn = algosdk.signMultisigTransaction(
			txn,
			multiSigParams,
			bob.account.sk
		).blob;
		// Sign with second account
		const twosigs = algosdk.appendSignMultisigTransaction(
			rawSignedTxn,
			multiSigParams,
			charlie.account.sk
		).blob;
		// decode the transaction
		const signedTxn: SignedTransaction = algosdk.decodeSignedTransaction(twosigs);
		// submit the transaction
		const confirmedTxn = runtime.executeTx([signedTxn]);
		[alice, elon] = runtime.defaultAccounts();
		//assert the balances are correct
		assert.equal(alice.balance(), defaultBalance - BigInt(fee) - BigInt(amount));
		assert.equal(elon.balance(), defaultBalance + BigInt(amount));
	});
});
