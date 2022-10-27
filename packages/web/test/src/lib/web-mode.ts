import algosdk, { Account, Transaction } from "algosdk";
import assert from "assert";

import { types, WebMode } from "../../../src";
import { AlgoSignerMock } from "../../mocks/algo-signer-mock";
import { receiverAccount, senderAccount } from "../../mocks/tx";

describe("Webmode - Algosigner test cases ", function () {
	let webMode: WebMode;
	let sender: Account;
	let receiver: Account;

	this.beforeEach(function () {
		sender = senderAccount;
		receiver = receiverAccount
		webMode = new WebMode(new AlgoSignerMock(), "Test");
	});

	it("Should executeTx without throwing an error", function () {
		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: sender,
			toAccountAddr: receiver.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
		assert.doesNotThrow(async function () {
			await webMode.executeTx([txnParams]);
		});
	});
	describe("Helper functions", () => {
		it("Should return a transaction object based on provided execParams", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 10000n,
				payFlags: {},
			};
			const txnParams = await webMode.getSuggestedParams(execParams.payFlags);
			const transactions: Transaction[] = webMode.makeTx([execParams], txnParams);
			assert.deepEqual(transactions[0].type, algosdk.TransactionType.pay);
			assert.deepEqual(algosdk.encodeAddress(transactions[0].from.publicKey), sender.addr);
			assert.deepEqual(algosdk.encodeAddress(transactions[0].to.publicKey), receiver.addr);
			assert.deepEqual(transactions[0].amount, 10000n);
		});

		it("Should sign a transaction and return a SignedTransaction object", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 10000n,
				payFlags: {},
			};
			const txnParams = await webMode.getSuggestedParams(execParams.payFlags);
			const transactions: Transaction[] = webMode.makeTx([execParams], txnParams);
			assert.doesNotThrow(async () => {
				await webMode.signTx(transactions[0]);
			});
		});

		it("Should return a SignedTransaction object based on ExecParams", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 10000n,
				payFlags: {},
			};
			const txnParams = await webMode.getSuggestedParams(execParams.payFlags);
			assert.doesNotThrow(async () => {
				await webMode.makeAndSignTx([execParams], txnParams);
			});
		});
	});
});
