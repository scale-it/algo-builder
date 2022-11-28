import algosdk, { Account, LogicSigAccount, Transaction } from "algosdk";
import assert from "assert";
import { expect } from "chai";

import { types, WebMode } from "../../../src";
import { AlgoSignerMock } from "../../mocks/algo-signer-mock";
import { createLsigAccount, receiverAccount, senderAccount } from "../../mocks/tx";

describe("Webmode - Algosigner test cases ", function () {
	let webMode: WebMode;
	let sender: Account;
	let receiver: Account;
	let lsigAccount: LogicSigAccount

	this.beforeEach(async function () {
		sender = senderAccount;
		receiver = receiverAccount;
		webMode = new WebMode(new AlgoSignerMock(), "Test");
		lsigAccount = await createLsigAccount()
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

	it("Should run executeTx function with a lsig transaction without throwing an error", async function () {
		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.LogicSignature,
			lsig: lsigAccount,
			fromAccountAddr: lsigAccount.address(),
			toAccountAddr: receiver.addr,
			amountMicroAlgos: 1e6,
			payFlags: {},
		};

		assert.doesNotThrow(async () => {
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
				const signTx = await webMode.signTx(transactions[0]);
				expect(signTx).to.have.ownProperty("txn");
				expect(signTx).to.have.ownProperty("sig");
				expect(signTx.sig).to.exist;
			});
		});

		it("Should sign a lsig transaction and return an object with blob and txID", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: lsigAccount.address(),
				lsig: lsigAccount,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 1e6,
				payFlags: {},
			};
			const txnParams = await webMode.getSuggestedParams(execParams.payFlags);
			const transactions: Transaction[] = webMode.makeTx([execParams], txnParams);
			assert.doesNotThrow(() => {
				const signTx = webMode.signLogicSignatureTxn(transactions[0], lsigAccount);
				expect(signTx).to.have.ownProperty("blob");
				expect(signTx).to.have.ownProperty("txID");
				expect(signTx.blob).to.exist;
				expect(signTx.txID).to.exist;
			});
		});
	});
});
