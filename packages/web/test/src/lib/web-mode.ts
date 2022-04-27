import algosdk, { Account } from "algosdk";

import { types, WebMode } from "../../../src";
import { AlgoSignerMock } from "../../mocks/algo-signer-mock";

describe("Webmode test", function () {
	let webMode: WebMode;
	let sender: Account;
	let receiver: Account;

	this.beforeEach(() => {
		sender = algosdk.generateAccount();
		receiver = algosdk.generateAccount();
		webMode = new WebMode(new AlgoSignerMock(), "Test");
	});

	it("#executeTx", async function () {
		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: sender,
			toAccountAddr: receiver.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
		const ans = await webMode.executeTx([txnParams]);
		console.log(ans);
	});
});
