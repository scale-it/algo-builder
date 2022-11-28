import algosdk, { Account, LogicSigAccount, Transaction } from "algosdk";
import assert from "assert";
import { expect } from "chai";

import { MyAlgoWalletSession, testnetURL, types } from "../../../src";
import { algoexplorerAlgod, getSuggestedParams } from "../../../src/lib/api";
import { HttpNetworkConfig } from "../../../src/types";
import { MyAlgoConnectMock } from "../../mocks/myalgowallet-mock";
import { createLsigAccount, receiverAccount, senderAccount } from "../../mocks/tx";

describe("Webmode - MyAlgo Wallet test cases ", () => {
	let connector: MyAlgoWalletSession;
	let sender: Account;
	let receiver: Account;
	let lsigAccount: LogicSigAccount
	const walletURL: HttpNetworkConfig = {
		token: "",
		server: testnetURL,
		port: "",
	};
	const algodClient: algosdk.Algodv2 = algoexplorerAlgod(walletURL);

	beforeEach(async () => {
		sender = senderAccount;
		receiver = receiverAccount;
		connector = new MyAlgoWalletSession(walletURL, new MyAlgoConnectMock());
		lsigAccount = await createLsigAccount()
	});

	it("Should executeTx without throwing an error", function () {
		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: sender,
			toAccountAddr: receiver.addr,
			amountMicroAlgos: 1e6,
			payFlags: {},
		};

		assert.doesNotThrow(async () => {
			await connector.executeTx([txnParams]);
		});
	});


	it("Should run executeTx function with a lsig transaction without throwing an error", function () {
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
			await connector.executeTx([txnParams]);
		});
	});

	describe("Helper functions", function () {
		it("Should return a transaction object based on provided execParams", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 1e6,
				payFlags: {},
			};
			const txnParams = await getSuggestedParams(algodClient);
			const transactions: Transaction[] = connector.makeTx([execParams], txnParams);
			assert.deepEqual(transactions[0].type, algosdk.TransactionType.pay);
			assert.deepEqual(algosdk.encodeAddress(transactions[0].from.publicKey), sender.addr);
			assert.deepEqual(algosdk.encodeAddress(transactions[0].to.publicKey), receiver.addr);
			assert.deepEqual(transactions[0].amount, 1e6);
		});

		it("Should sign a transaction and return a SignedTransaction object", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 1e6,
				payFlags: {},
			};
			const txnParams = await getSuggestedParams(algodClient);
			const transactions: Transaction[] = connector.makeTx([execParams], txnParams);
			assert.doesNotThrow(async () => {
				const signTx = await connector.signTx(transactions[0]);
				expect(signTx).to.have.ownProperty("txn");
				expect(signTx).to.have.ownProperty("sig");
				expect(signTx.sig).to.exist;
			});
		});

		it("Should return a SignedTransaction object based on ExecParams", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 1e6,
				payFlags: {},
			};
			const txnParams = await getSuggestedParams(algodClient);
			assert.doesNotThrow(async () => {
				const signTx = await connector.makeAndSignTx([execParams], txnParams);
				expect(signTx[0]).to.have.ownProperty("txn");
				expect(signTx[0]).to.have.ownProperty("sig");
				expect(signTx[0].sig).to.exist;
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
			const txnParams = await getSuggestedParams(algodClient);
			const transactions: Transaction[] = connector.makeTx([execParams], txnParams);
			assert.doesNotThrow(async () => {
				const signTx = connector.signLogicSignatureTxn(transactions[0], lsigAccount);
				expect(signTx).to.have.ownProperty("blob");
				expect(signTx).to.have.ownProperty("txID");
				expect(signTx.blob).to.exist;
				expect(signTx.txID).to.exist;
			});
		});
	});
});
