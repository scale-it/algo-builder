import algosdk, { Account, Transaction } from "algosdk";
import assert from "assert";

import { MyAlgoWalletSession, testnetURL, types } from "../../../src";
import { algoexplorerAlgod, getSuggestedParams } from "../../../src/lib/api";
import { HttpNetworkConfig } from "../../../src/types";
import MyAlgoConnectMock from "../../mocks/myalgowallet-mock";

describe("Webmode - MyAlgo Wallet test cases ", () => {
	let connector: MyAlgoWalletSession;
	let sender: Account;
	let receiver: Account;
	let algodClient: algosdk.Algodv2;
	const walletURL: HttpNetworkConfig = {
		token: "",
		server: testnetURL,
		port: "",
	}
	algodClient = algoexplorerAlgod(walletURL);

	beforeEach(() => {
		sender = algosdk.generateAccount();
		receiver = algosdk.generateAccount();
		connector = new MyAlgoWalletSession(walletURL, new MyAlgoConnectMock());

	});

	it("Should executeTx without throwing an error", async function () {
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
				await connector.signTx(transactions[0]);
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
				await connector.makeAndSignTx([execParams], txnParams);
			});
		});

		it("Should send a signed transaction and wait specified rounds for confirmation", async function () {
			const execParams: types.AlgoTransferParam = {
				type: types.TransactionType.TransferAlgo,
				sign: types.SignType.SecretKey,
				fromAccount: sender,
				toAccountAddr: receiver.addr,
				amountMicroAlgos: 1e6,
				payFlags: {},
			};
			const txnParams = await getSuggestedParams(algodClient);
			const signedTx = await connector.makeAndSignTx([execParams], txnParams);
			assert.doesNotThrow(async () => {
				await connector.sendTxAndWait(signedTx);
			});
		});
	});

});
