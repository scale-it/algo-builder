import algosdk, { Account } from "algosdk";
import assert from "assert";

import { types, WebMode } from "../../../src";
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
});
