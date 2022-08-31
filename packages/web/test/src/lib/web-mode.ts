import algosdk, { Account, SignedTransaction, Transaction } from "algosdk";
import assert from "assert";

import { types, WebMode } from "../../../src";
import { ExecParams } from "../../../src/types";
import { AlgoSignerMock } from "../../mocks/algo-signer-mock";

describe("Webmode - Algosigner test cases ", function () {
	let webMode: WebMode;
	let sender: Account;
	let receiver: Account;

	this.beforeEach(() => {
		sender = algosdk.generateAccount();
		receiver = algosdk.generateAccount();
		webMode = new WebMode(new AlgoSignerMock(), "Test");
	});

	it("Should executeTx without throwing an error", async function () {
		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: sender,
			toAccountAddr: receiver.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
		assert.doesNotThrow(async () => {
			await webMode.executeTx([txnParams]);
		});
	});
	describe("helper functions", () => {
		it("Should return a transaction object based on provided execParams", () => {
			const txnParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 10000n,
				payFlags: {},
			};
			const transactions: Transaction[] = webMode.makeTx([txnParams]);
			assert.deepEqual(transactions[0].type, algosdk.TransactionType.pay);
			assert.deepEqual(transactions[0].from, sender.addr);
			assert.deepEqual(transactions[0].to, receiver.addr);
			assert.deepEqual(transactions[0].amount, 10000n);
		});

		it("Should sign a transaction and return a SignedTransaction object", () => {
			const txnParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 10000n,
				payFlags: {},
			};
			const transactions: Transaction[] = webMode.makeTx([txnParams]);
			assert.doesNotThrow(() => {
				webMode.signTx(transactions[0], sender);
			});
		});

		it("Should return a SignedTransaction object based on ExecParams", () => {
			const txnParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 10000n,
				payFlags: {},
			};
			assert.doesNotThrow(() => {
				webMode.makeAndSignTx([txnParams]);
			});
		});

		it("Should send a signed transaction and wait specified rounds for confirmation", () => {
			const txnParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 10000n,
				payFlags: {},
			};
			const signedTx = webMode.makeAndSignTx([txnParams]);
			assert.doesNotThrow(() => {
				webMode.sendTxAndWait(signedTx);
			});
		});
	});
});
