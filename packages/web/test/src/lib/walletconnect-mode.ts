import WalletConnect from "@walletconnect/client";
import algosdk, { Account, Transaction } from "algosdk";
import assert from "assert";
import QRCodeModal from "algorand-walletconnect-qrcode-modal";
import { testnetURL, types, WallectConnectSession } from "../../../src";
import { algoexplorerAlgod, getSuggestedParams } from "../../../src/lib/api";
import { HttpNetworkConfig } from "../../../src/types";

describe("Webmode - Wallet Connect test cases ", function () {
    let connector: WallectConnectSession;
    let sender: Account;
    let receiver: Account;

    let algodClient: algosdk.Algodv2;
    const walletURL: HttpNetworkConfig = {
        token: "",
        server: testnetURL,
        port: "",
    }
    algodClient = algoexplorerAlgod(walletURL);

    this.beforeEach(async function () {
        sender = algosdk.generateAccount();
        receiver = algosdk.generateAccount();
        connector = new WallectConnectSession(walletURL, new WalletConnect({
            bridge: "https://bridge.walletconnect.org",
            qrcodeModal: QRCodeModal,
        }));
        await connector.create();
        connector.onConnect((error, response) => { console.log(error, response) });
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

            const txnParams = await getSuggestedParams(algodClient)
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
            const txnParams = await getSuggestedParams(algodClient)
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
            const txnParams = await getSuggestedParams(algodClient)
            const signedTx = await connector.makeAndSignTx([execParams], txnParams);
            assert.doesNotThrow(async () => {
                await connector.sendTxAndWait(signedTx);
            });
        });
    });
});
