import algosdk, { Account, LogicSigAccount, Transaction } from "algosdk";
import assert from "assert";

import { testnetURL, types, WallectConnectSession } from "../../../src";
import { algoexplorerAlgod, getSuggestedParams } from "../../../src/lib/api";
import { HttpNetworkConfig } from "../../../src/types";
import { createLsigAccount, receiverAccount, senderAccount } from "../../mocks/tx";
import { WalletConnectMock } from "../../mocks/walletconnect-mock";

describe("Webmode - Wallet Connect test cases ", function () {
	let connector: WallectConnectSession;
	let sender: Account;
	let receiver: Account;
	let lsigAccount: LogicSigAccount
	const walletURL: HttpNetworkConfig = {
		token: "",
		server: testnetURL,
		port: "",
	};
	const algodClient: algosdk.Algodv2 = algoexplorerAlgod(walletURL);

	this.beforeEach(async function () {
		sender = senderAccount;
		receiver = receiverAccount;
		const noop = () => {
			/* do nothing */
		};

		connector = new WallectConnectSession(
			walletURL,
			new WalletConnectMock({
				cryptoLib: {
					generateKey: async () => new Promise((resolve, reject) => resolve(new Uint8Array(0))),
					encrypt: async () =>
						new Promise((resolve, reject) =>
							resolve({
								data: "",
								hmac: "",
								iv: "",
							})
						),
					decrypt: async () => new Promise((resolve, reject) => resolve(null)),
				},
				connectorOpts: {
					bridge: "https://bridge.walletconnect.org",
					uri: "",
					session: {
						connected: true,
						accounts: [senderAccount.addr, receiverAccount.addr],
						chainId: 0,
						bridge: "https://bridge.walletconnect.org",
						key: "key",
						clientId: "id",
						peerId: "peerid",
						handshakeId: 1,
						handshakeTopic: "",
						clientMeta: null,
						peerMeta: null,
					},
				},
				transport: {
					open: noop,
					close: noop,
					send: noop,
					subscribe: noop,
					on: noop,
				},
			})
		);
		lsigAccount = await createLsigAccount()
	});

	it("Should run executeTx function without throwing an error", function () {
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

	describe("Helper functions", () => {
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

		it("Should sign a lsig transaction and return a SignedTransaction object", async function () {
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
			assert.doesNotThrow(() => {
				connector.signLogicSignatureTxn(transactions[0], lsigAccount);
			});
		});
	});
});
