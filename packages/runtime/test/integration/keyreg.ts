import { types } from "@algo-builder/web";
import { LogicSigAccount } from "algosdk";
import { assert } from "chai";

import { AccountStore, Runtime } from "../../src/index";
import { ALGORAND_ACCOUNT_MIN_BALANCE } from "../../src/lib/constants";
import { BaseTxReceipt } from "../../src/types";
import { useFixture } from "../helpers/integration";

const minBalance = BigInt(ALGORAND_ACCOUNT_MIN_BALANCE + 5000);
describe("Key Registration transaction", function () {
  useFixture("basic-teal");
  let john: AccountStore;
  let bob: AccountStore;
  let runtime: Runtime;
  let txParams: types.AlgoTransferParam;

  this.beforeAll(async function () {
    john = new AccountStore(minBalance);
    bob = new AccountStore(minBalance);
    runtime = new Runtime([john, bob]);

    txParams = {
      type: types.TransactionType.TransferAlgo, // payment
      sign: types.SignType.LogicSignature,
      fromAccountAddr: john.account.addr,
      toAccountAddr: bob.address,
      amountMicroAlgos: 100,
      lsig: {} as LogicSigAccount, // will be set below
      payFlags: { totalFee: 1000 }
    };
  });

  // helper function
  function syncAccounts (): void {
    john = runtime.getAccount(john.address);
    bob = runtime.getAccount(bob.address);
  }

  it("should do noop on keyreg tx (secret key)", function () {
    const txSKParams: types.KeyRegistrationParam = {
      type: types.TransactionType.KeyRegistration, // payment
      sign: types.SignType.SecretKey,
      fromAccount: john.account,
      voteKey: 'v-key',
      selectionKey: 's-key',
      voteFirst: 43,
      voteLast: 1000,
      voteKeyDilution: 5,
      payFlags: { totalFee: 1000 }
    };

    const r = runtime.executeTx(txSKParams) as BaseTxReceipt;
    assert.isDefined(r);
    assert.isDefined(r.txn);
    assert.isDefined(r.txID);
    syncAccounts();
  });

  it("should do noop on keyreg tx (logic sig)", function () {
    const lsig = runtime.loadLogic('basic.teal');
    lsig.sign(john.account.sk);

    const txLsigParams: types.KeyRegistrationParam = {
      type: types.TransactionType.KeyRegistration, // payment
      sign: types.SignType.LogicSignature,
      fromAccountAddr: john.account.addr,
      voteKey: 'v-key',
      selectionKey: 's-key',
      voteFirst: 43,
      voteLast: 1000,
      voteKeyDilution: 5,
      lsig: lsig,
      payFlags: { totalFee: 1000 }
    };

    const r = runtime.executeTx(txLsigParams) as BaseTxReceipt;
    assert.isDefined(r);
    assert.isDefined(r.txn);
    assert.isDefined(r.txID);
    syncAccounts();
  });
});
