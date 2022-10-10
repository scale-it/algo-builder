import MyAlgoConnect from "@randlabs/myalgo-connect";
import algosdk, { Account } from "algosdk";
import assert from "assert";

import { MyAlgoWalletSession, types } from "../../../src";
import { algoexplorerAlgod, mkTxParams } from "../../../src/lib/api";
import { mkTransaction } from "../../../src/lib/txn";
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

	it("Should signTx without throwing an error", async () => {
		const txnParams: types.AlgoTransferParam = {
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: sender,
			toAccountAddr: receiver.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		}
		assert.doesNotThrow(async () => {
			await connector.signTransaction(mkTransaction(txnParams, await mkTxParams(algodClient, txnParams.payFlags)));
		})
	});

});
