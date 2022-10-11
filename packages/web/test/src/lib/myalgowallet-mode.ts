import MyAlgoConnect from "@randlabs/myalgo-connect";
import algosdk, { Account, Transaction } from "algosdk";
import assert from "assert";

import { MyAlgoWalletSession, types } from "../../../src";
import { algoexplorerAlgod, getSuggestedParams } from "../../../src/lib/api";
import { HttpNetworkConfig } from "../../../src/types";
import MyAlgoConnectMock from "../../mocks/myalgowallet-mock";

describe("Webmode - MyAlgo Wallet test cases ", () => {
	let connector: MyAlgoWalletSession;
	let sender: Account;
	let receiver: Account;
	let algodClient: algosdk.Algodv2;
	const walletURL: HttpNetworkConfig = {
		token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		server: "http://localhost",
		port: 4001,
	}
	algodClient = algoexplorerAlgod(walletURL);

	beforeEach(() => {
		MyAlgoConnect
		sender = algosdk.generateAccount();
		receiver = algosdk.generateAccount();
		connector = new MyAlgoWalletSession(walletURL, new MyAlgoConnectMock());

	});

	it("Should executeTx without throwing an error", async () => {
		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: sender,
			toAccountAddr: receiver.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};

		assert.doesNotThrow(async () => {
			await connector.executeTx([txnParams]);
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
			const txnParams = await getSuggestedParams(algodClient);
			const transactions: Transaction[] = connector.makeTx([execParams], txnParams);
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
				amountMicroAlgos: 10000n,
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
				amountMicroAlgos: 10000n,
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
