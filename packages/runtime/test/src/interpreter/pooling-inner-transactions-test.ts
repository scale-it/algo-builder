import { decodeAddress, getApplicationAddress } from "algosdk";
import { assert } from "chai";
import { bobAcc } from "../../../../algob/test/mocks/account";
import { AccountStore } from "../../../src/account";
import { RUNTIME_ERRORS } from "../../../src/errors/errors-list";
import { Runtime } from "../../../src/index";
import { Interpreter } from "../../../src/interpreter/interpreter";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../../src/lib/constants";
import { AccountAddress, AccountStoreI, ExecutionMode, TxOnComplete } from "../../../src/types";
import { expectRuntimeError } from "../../helpers/runtime-errors";
import { elonMuskAccount, johnAccount } from "../../mocks/account";
import { accInfo } from "../../mocks/stateful";
import { elonAddr, TXN_OBJ } from "../../mocks/txn";

export function setDummyAccInfo(acc: AccountStoreI): void {
    acc.appsLocalState = accInfo[0].appsLocalState;
    acc.appsTotalSchema = accInfo[0].appsTotalSchema;
    acc.createdApps = accInfo[0].createdApps;
}

describe("Pooling Inner Transactions", function () {
    const elonPk = decodeAddress(elonAddr).publicKey;
    const balance = 1e9;
    let interpreter: Interpreter;
    let elonAcc: AccountStoreI;
    let johnAcc: AccountStoreI;
    let bobAccount: AccountStoreI;
    let appAccAddr: AccountAddress;
    let applicationAccount: AccountStoreI;
    let foreignAppAccAddr: AccountAddress;
    let foreignApplicationAccount: AccountStoreI;

    const reset = (): void => {
        while (interpreter.stack.length() !== 0) {
            interpreter.stack.pop();
        }
        interpreter.currentInnerTxnGroup = [];
        interpreter.runtime.ctx.pooledApplCost = 0;
        interpreter.instructions = [];
        interpreter.innerTxnGroups = [];
        interpreter.instructionIndex = 0;
        interpreter.runtime.ctx.tx = { ...TXN_OBJ, snd: Buffer.from(elonPk) };
        interpreter.runtime.ctx.gtxs = [interpreter.runtime.ctx.tx];
        interpreter.runtime.ctx.isInnerTx = false;
        // set new tx receipt
        interpreter.runtime.ctx.state.txReceipts.set(TXN_OBJ.txID, {
            txn: TXN_OBJ,
            txID: TXN_OBJ.txID,
        });
    };

    const setUpInterpreter = (
        tealVersion: number,
        appBalance: number = ALGORAND_ACCOUNT_MIN_BALANCE
    ): void => {
        // setup 1st account (to be used as sender)
        elonAcc = new AccountStore(0, elonMuskAccount); // setup test account
        setDummyAccInfo(elonAcc);

        // setup 2nd account
        johnAcc = new AccountStore(0, johnAccount);

        // setup 3rd account
        bobAccount = new AccountStore(1000000, bobAcc);

        // setup application account
        appAccAddr = getApplicationAddress(TXN_OBJ.apid);
        applicationAccount = new AccountStore(appBalance, {
            addr: appAccAddr,
            sk: new Uint8Array(0),
        });

        // setup foreign application account
        foreignAppAccAddr = getApplicationAddress(TXN_OBJ.apfa[1]);
        foreignApplicationAccount = new AccountStore(appBalance, {
            addr: foreignAppAccAddr,
            sk: new Uint8Array(0),
        });

        interpreter = new Interpreter();
        interpreter.runtime = new Runtime([elonAcc, johnAcc, bobAccount,
            applicationAccount, foreignApplicationAccount]);
        interpreter.tealVersion = tealVersion;
        reset();
    };

    const executeTEAL = (tealCode: string, onComplete = TxOnComplete.NoOp): void => {
        // reset interpreter
        reset();
        interpreter.runtime.ctx.tx.apan = Number(onComplete);
        interpreter.execute(tealCode, ExecutionMode.APPLICATION, interpreter.runtime, 0);
    };

    describe("Pooling fee tests in group txns", function () {
        this.beforeEach(function () {
            setUpInterpreter(7, balance);
        });

        it("Should succeed: when unfunded account opts-in in a group txn", function () {
            setUpInterpreter(7, 0);
            const elonAcc = interpreter.runtime.ctx.state.accounts.get(elonAddr);
            TXN_OBJ.apat.push(Buffer.from(decodeAddress(applicationAccount.address).publicKey));
            TXN_OBJ.apat.push(Buffer.from(decodeAddress(bobAccount.address).publicKey));

            if (elonAcc) {
                elonAcc.amount = 1000000n;
                const assetID = interpreter.runtime.ctx.deployASADef(
                    "test-asa",
                    { total: 10, decimals: 0, unitName: "TASA" },
                    elonAddr,
                    { creator: { ...elonAcc.account, name: "elon" } }
                ).assetIndex;

                bobAccount.account.rekeyTo(applicationAccount.address);

                TXN_OBJ.apas = [assetID];

                assert.equal(interpreter.runtime.ctx.state.accounts
                    .get(johnAcc.address)?.balance()
                    , 0n);

                const prog = `
                    itxn_begin
                    int axfer
                    itxn_field TypeEnum
                    global CurrentApplicationAddress
                    itxn_field AssetReceiver
                    int ${assetID}
                    itxn_field XferAsset
                    int 0
                    itxn_field AssetAmount
                    int 0
                    itxn_field Fee
                    itxn_next
                    int pay
                    itxn_field TypeEnum
                    global CurrentApplicationAddress
                    itxn_field Receiver
                    addr ${bobAccount.address}
                    itxn_field Sender
                    int 1000
                    itxn_field Amount
                    int 2000
                    itxn_field Fee
                    itxn_submit
                    int 1
                    return
                    `;

                assert.doesNotThrow(() => executeTEAL(prog));

                assert.equal(interpreter.runtime.ctx.state.accounts
                    .get(bobAccount.address)?.balance()
                    , 1000000n - 3000n);
                assert.equal(interpreter.runtime.ctx.state.accounts
                    .get(johnAcc.address)?.balance()
                    , 0n);
                assert.equal(interpreter.runtime.ctx.state.accounts
                    .get(appAccAddr)?.balance()
                    , 1000n);
                assert.isDefined(interpreter.runtime.ctx.state.accounts
                    .get(appAccAddr)?.getAssetHolding(assetID));

            }

        });

        it("Should succeed: when funded account partially covers it's own fee", function () {
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(johnAcc.address)?.balance()
                , 0n);

            const prog = `
				itxn_begin
				int pay
				itxn_field TypeEnum
				txn Applications 2
				app_params_get AppAddress
				assert
				itxn_field Receiver
				int 0
				itxn_field Amount
				//partially covering it's own fee
				int 1
				itxn_field Fee
				itxn_next
				int pay
				itxn_field TypeEnum
				txn Sender
				itxn_field Receiver
				int 1000
				itxn_field Amount
				//partially covering it's own fee
				int 1999
				itxn_field Fee
				itxn_submit
				int 1
				return
				`;
            assert.doesNotThrow(() => executeTEAL(prog));
            // verify deducted fee
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(appAccAddr)?.balance()
                , BigInt(balance) - 3000n);
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(johnAcc.address)?.balance()
                , 0n);
        });

        it("Should succeed: when txn fee is covered in group txns", function () {
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(johnAcc.address)?.balance()
                , 0n);

            const prog = `
				itxn_begin
				int pay
				itxn_field TypeEnum
				txn Applications 2
				app_params_get AppAddress
				assert
				itxn_field Receiver
				int 1000
				itxn_field Amount
				int 1000
				itxn_field Fee
				itxn_next
				int pay
				itxn_field TypeEnum
				txn Sender
				itxn_field Receiver
				int 1000
				itxn_field Amount
				int 1000
				itxn_field Fee
				itxn_submit
				int 1
				return
				`;
            assert.doesNotThrow(() => executeTEAL(prog));

            // verify deducted fee
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(appAccAddr)?.balance()
                , BigInt(balance) - 4000n);
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(johnAcc.address)?.balance()
                , 0n);
        });

        it("Should fail: when txn fee is not covered in group txns", function () {
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(johnAcc.address)?.balance()
                , 0n);

            const prog = `
				itxn_begin
				int pay
				itxn_field TypeEnum
				txn Applications 2
				app_params_get AppAddress
				assert
				itxn_field Receiver
				int 1000
				itxn_field Amount
				int 0
				itxn_field Fee
				itxn_next
				int pay
				itxn_field TypeEnum
				txn Sender
				itxn_field Receiver
				int 1000
				itxn_field Amount
				// txn fee of 1000 is covered but 2000 is required
				int 1000
				itxn_field Fee
				itxn_submit
				int 1
				return
				`;

            expectRuntimeError(
                () => executeTEAL(prog),
                RUNTIME_ERRORS.TRANSACTION.FEES_NOT_ENOUGH
            );
        });

        it("Should fail: when unfunded account sends fund in group txn", function () {
            assert.equal(interpreter.runtime.ctx.state.accounts
                .get(johnAcc.address)?.balance()
                , 0n);

            const prog = `
				itxn_begin
				int pay
				itxn_field TypeEnum
				txn Applications 2
				app_params_get AppAddress
				assert
				itxn_field Receiver
				int 1000
				itxn_field Amount
				int 0
				itxn_field Fee
				itxn_next
				int pay
				itxn_field TypeEnum
				txn Sender
				itxn_field Receiver
				int 1000
				itxn_field Amount
				int 2000
				itxn_field Fee
				int 1
				return
				`;
            assert.doesNotThrow(() => executeTEAL(prog));
        });

        it("Should fail: when unfunded account covers it's own fee", function () {
            setUpInterpreter(7, 0);
            const elonAcc = interpreter.runtime.ctx.state.accounts.get(elonAddr);
            if (elonAcc) {
                elonAcc.amount = 1000000n;
                const assetID = interpreter.runtime.ctx.deployASADef(
                    "test-asa",
                    { total: 10, decimals: 0, unitName: "TASA" },
                    elonAddr,
                    { creator: { ...elonAcc.account, name: "elon" } }
                ).assetIndex;
                TXN_OBJ.apas = [assetID];

                // rekey bobAccount to application
                bobAccount.account.rekeyTo(applicationAccount.address);
                assert.equal(interpreter.runtime.ctx.state.accounts
                    .get(johnAcc.address)?.balance()
                    , 0n);

                const prog = `
                    itxn_begin
					int axfer
					itxn_field TypeEnum
					global CurrentApplicationAddress
					itxn_field AssetReceiver
					int ${assetID}
					itxn_field XferAsset
					int 0
					itxn_field AssetAmount
					int 1
					itxn_field Fee
					itxn_next
					int pay
					itxn_field TypeEnum
					txn Sender
					itxn_field Receiver
					addr ${bobAccount.address}
					itxn_field Sender
					int 1000
					itxn_field Amount
					int 1999
					itxn_field Fee
					itxn_submit
					int 1
					return
					`;

                expectRuntimeError(
                    () => executeTEAL(prog),
                    RUNTIME_ERRORS.TRANSACTION.INSUFFICIENT_ACCOUNT_BALANCE
                );
            }
        });
    });
});
