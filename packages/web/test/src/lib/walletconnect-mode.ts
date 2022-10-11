import WalletConnect from "@walletconnect/client";
import algosdk, { Account, Transaction } from "algosdk";
import assert from "assert";
import QRCodeModal from "algorand-walletconnect-qrcode-modal";
import { types, WallectConnectSession } from "../../../src";
import { algoexplorerAlgod, getSuggestedParams } from "../../../src/lib/api";
import { HttpNetworkConfig } from "../../../src/types";

describe("Webmode - Wallet Connect test cases ", function () {
    let connector: WallectConnectSession;
    let sender: Account;
    let receiver: Account;

    let algodClient: algosdk.Algodv2;
    const walletURL: HttpNetworkConfig = {
        token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        server: "http://localhost",
        port: 4001,
    }
    algodClient = algoexplorerAlgod(walletURL);

    this.beforeEach(function () {
        sender = algosdk.generateAccount();
        receiver = algosdk.generateAccount();
        connector = new WallectConnectSession(walletURL, new WalletConnect({
            bridge: "https://bridge.walletconnect.org",
            qrcodeModal: QRCodeModal,
        }));
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
        assert.doesNotThrow(async () => {
            await connector.executeTx([txnParams]);
        });
    });

    describe("Helper functions", () => {
        it("Should sign a transaction and return a SignedTransaction object", async function () {
            const execParams: types.AlgoTransferParam = {
                type: types.TransactionType.TransferAlgo,
                sign: types.SignType.SecretKey,
                fromAccount: sender,
                toAccountAddr: receiver.addr,
                amountMicroAlgos: 10000n,
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
                amountMicroAlgos: 10000n,
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
                amountMicroAlgos: 10000n,
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
