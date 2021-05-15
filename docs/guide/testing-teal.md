---
layout: splash
---

# Testing TEAL

[TEAL](https://developer.algorand.org/docs/reference/teal/specification/) is a stack based language that executes inside Algorand transactions to program logic signatures and smart contracts. `@algo-builder/runtime` provides a TypeScript and JavaScript, lightweight runtime and TEAL interpreter to test Algorand transactions, ASA and Smart Contracts.

**NOTE:** TEAL can not modify nor create transactions.

## How it works

The `@algo-builder/runtime` (TypeScript Algorand runtime) package has 4 major components:

- [Runtime](https://scale-it.github.io/algo-builder/api/runtime/classes/runtime.html): process transaction or txn group, and manages state. `algob` user interacts directly with `Runtime` to set up accounts and post transactions (create applications, upate application, opt-in to app, ASA ...).
- [AccountStore](https://scale-it.github.io/algo-builder/api/runtime/classes/accountstore.html): `AccountStore` object represents an Alogrand compatible account, which stores all account related information (`apps`, `assets`, `localState`, `globalState` etc..).
- [Parser](https://scale-it.github.io/algo-builder/api/runtime/modules.html#parser): parses TEAL code and returns a list of opcodes which are executable by the `Interpreter`. If any opcode/data in teal code is invalid, parser will throw an error.
- [Interpreter](https://scale-it.github.io/algo-builder/api/runtime/classes/interpreter.html): Executes the list of opcodes returned by the parser and updates `Runtime` current transaction context after each opcode execution. At the end of execution, if the execution stack contains a single non-zero uint64 element then the teal code is approved, and and current transaction context is committed. If transaction is executed in a group context, then the state commit only happens if all transactions in the group pass.


## Block Rounds/Height

In Algorand blockchain, transaction processing is divided into rounds. At each round blockchain creates a block with transactions which update the state. All transactions in the same block have the same transaction time and block height.
In Alogrand Builder Runtime, we don't have blocks. All transactions are processed immediately.
However, we keep the notion of rounds and timestamps because it is needed for transaction and smart contract processing.

The default Runtime block round is set to `2` and timestamp to `1`. Runtime doesn't change the block round or timestamp - it's up to the user to set in when designing a test flow. To change the block round and timestamp we need to call `runtime.setRoundAndTimestamp(round, timestamp)`. We can retrieve the current block round and timestamp using `runtime.getRound()` and `runtime.getTimestamp()` respectively. <br />
Example:

    runtime.setRoundAndTimestamp(5, 10); // set current block round to 5 and timestamp to 10

This means that current block round is set to 5 and transaction will pass only if its' first valid round is less or equal 5 and the last valid round is greater than 5.
Note: Block round and timestamp remains same until user will change it again.


## Project Structure

```
algob project:
├── assets
│   ├── TEAL files
│   ├── PyTEAL files
├── scripts
│   ├── deploy.ts
│   ├── run.ts
├── test
│   ├── JS test files
│   ├── .mocharc.json (optional)
├── package.json
```

All our test files should be stored in `test` directory. In the test files, you can import `algob` as a library as well as functions from `scripts`.
Tests are typically done using [Mocha](https://mochajs.org/) framework, while assertions using [Chai](https://www.chaijs.com/) a BDD / TDD assertion library. Your test file is usually organized as follows:

```
describe("use-case", function() {
  let variable1;
  // ...

  this.beforeAll(() => { ... });
  this.afterAll(() => { ... });

  it("test case 1", () => {
    // preparation
    // execution
    // checks
  });

  it("test case 2", () => { ... });
});
```

Please read more about  [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/) if you are not familiar with them.


## Test structure

In this section we will describe the flow of testing smart contracts in runtime:

- **Prepare Accounts**. First of all we need to create accounts which we will use in transactions:

  ```javascript
  const john = new AccountStore(initialMicroAlgo);
  const bob = new AccountStore(initialMicroAlgo);
  ```
  `initialAlgo` is the amount of ALGO set for the created account. It's recommended to have at least 1 ALGO (1000000 micro ALGO) to cover transaction fees and to maintain minimum account balance.

- **Prepare Runtime**. Next we create a runtime with those accounts.

  ```javascript
  const runtime = new Runtime([john, bob]);
  ```

- **Set block round and timestamp**.

  ```javascript
  runtime.setRoundAndTimestamp(20, 100);
  ```

- **Create Apps/Assets**. At this point our runtime is ready. Now we can create apps and assets, and begin testing our smart contracts (present in your current directory's `asset` folder). To create a stateful application (smart contract), use `runtime.addApp()` funtcion. Similarly to create a new asset use `runtime.addAsset()` function.
- **Create and Execute Transactions**. We can create transactions to test our smart contracts. You create a tranaction (Payment Transaction, Atomic Transfers, Asset Transfer etc...) as you would do it in algob: either using the JS SDK, or one of the high level algob functions. To execute tranasction use `runtime.executeTx()` funtion.
- **Update/Refresh State**. After a transaction is executed the state of an account will be updated. In order to inspect a new state of accounts we need to re-query them from the runtime. In algob examples we use `syncAccounts()` closure (see [example](https://github.com/scale-it/algo-builder/blob/6743acd/examples/restricted-assets/test/asset-txfer-test.js#L80)) closure which will reassign accounts to their latest state.
- **Verify State**: Now, we can verify if the `global state` and `local state` as well as accounts are correctly updated. We use `runtime.getGlobalState()` and `runtime.getLocalState()` to check the state and directly inspect account objects (after the `syncAccounts` is made).


## Run tests

TL;DR: Write tests in `/test` directory and then call `mocha`:

    mocha <test_name or path>

or you can also run tests using algob

    algob test

See one of our examples for more details (eg: `examples/crowdfunding/test`).


### Stateless TEAL

#### Escrow Account

Let's try to execute a transaction where a user (say `john`) can withdraw funds from an `escrow` account based on a stateless smart contract logic. In the example below, we will use a TEAL code from our [escrow account test](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/fixtures/escrow-account/assets/escrow.teal).
The logic signature accepts only ALGO payment transaction where amount is <= 100 AND receiver is `john` AND fee <= 10000.

- First let's prepare the runtime and state: initialize accounts, get a logic signature for escrow and set up runtime:
  ```javascript
  const minBalance = BigInt(ALGORAND_ACCOUNT_MIN_BALANCE + 1000); // 1000 to cover fee
  const initialEscrowHolding = minBalance + BigInt(1000e6);
  const initialJohnHolding = minBalance + 500n;
  const fee = 1000;

  // admin is an account used to fund escrow
  let admin = new AccountStore(1e12);
  let john = new AccountStore(initialJohnHolding);
  const lsig = runtime.getLogicSig(getProgram('escrow.teal'), []);
  let escrow = runtime.getAccount(lsig.address());
  const runtime = new Runtime([john]); // setup runtime
  ```

- We create a helper function to update local accounts based on the runtime state
  ```javascript
  function syncAccounts() {
    john = runtime.getAccount(john.address);
    escrow = runtime.getAccount(escrow.address);
  }
  ```

- Execute transaction (using `runtime.executeTx()`) with valid txnParams.
  ```typescript
  // set up transaction paramenters
  let paymentTxParams: AlgoTransferParam = {
    type: TransactionType.TransferAlgo,
    sign: SignType.LogicSignature,
    lsig: lsig,
    fromAccountAddr: escrow.address,
    toAccountAddr: john.address,
    amountMicroAlgos: 100n,
    payFlags: { totalFee: fee },
  };

  it("should fund escrow account", function(){
    runtime.executeTx({
      type: TransactionType.TransferAlgo, // payment
      sign: SignType.SecretKey,
      fromAccount: admin.account,
      toAccountAddr: escrow.address,
      amountMicroAlgos: initialEscrowHolding,
      payFlags: { totalFee: fee },
    });

    // check initial balance
    syncAccounts();
    assert.equal(escrow.balance(), initialEscrowHolding);
    assert.equal(john.balance(), initialJohnHolding);
  })

  it("should withdraw funds from escrow if txn params are correct", function() {
    runtime.executeTx(paymentTxParams);

    // check final state (updated accounts)
    syncAccounts();
    assert.equal(escrow.balance(), initialEscrowHolding - 100n - BigInt(fee));
    assert.equal(john.balance(), initialJohnHolding + 100n);
  });
  ```
  In the first test above, we fund the escrow using the admin account. John already has an initial balance set - we initialized runtime with John's account. In the second test we execute payment transaction from escrow to john and validate that the balances are correct.

- Executing transaction with invalid transaction.
  ```javascript
  it("should reject transaction if amount > 100", function() {
    expectRuntimeError(
      () => runtime.executeTx({...paymentTxParams, amountMicroAlgos: 500n}),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });
  ```

Full example with above tests is available in our [escrow-account.ts](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/escrow-account.ts) integration test suite.


#### Delegated Signature Account

Let's try to execute a transaction where a user (`john`) will use delegated signature based on a stateless smart contract logic. We will use a TEAL code from our [asset test](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/fixtures/basic-teal/assets/basic.teal) suite.

  - As before we start with preparing the runtime. We use `runtime.getLogicSig(getProgram('escrow.teal'), [])` to create a logic signature.

  ```javascript
  let john = new AccountStore(initialJohnHolding);
  let bob = new AccountStore(initialBobHolding);
  let runtime = new Runtime([john, bob]);
  ```

  - We will create a test with valid delegated signature check and try to use it to send ALGO from the delegator account.

  ```typescript
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.LogicSignature,
    fromAccountAddr: john.account.addr,
    toAccountAddr: bob.address,
    amountMicroAlgos: 100n,
    lsig: {} as LogicSig, // will be set below
    payFlags: { totalFee: fee }
  };

  it("should send algo's from john to bob if delegated logic check passes", function () {
    // check initial balance
    assert.equal(john.balance(), initialJohnHolding);
    assert.equal(bob.balance(), initialBobHolding);

    // get delegated logic signature
    const lsig = runtime.getLogicSig(getProgram('basic.teal'), []);
    lsig.sign(john.account.sk);
    txnParams.lsig = lsig;

    runtime.executeTx(txnParams);

    syncAccounts();
    assert.equal(john.balance(), initialJohnHolding - 100n - BigInt(fee));
    assert.equal(bob.balance(), initialBobHolding + 100n);
  });
  ```

  - In the next test, create a delegated signature whose verification will fail. We check that the transfer was not done and the balances didn't change.

  ```javascript
  it("should fail if delegated logic check doesn't pass", function () {
    const johnBal = john.balance();
    const bobBal = bob.balance();
    const lsig = runtime.getLogicSig(getProgram('incorrect-logic.teal'), []);
    lsig.sign(john.account.sk);
    txnParams.lsig = lsig;

    // should fail because logic check fails
    expectRuntimeError(
      () => runtime.executeTx({...txnParams, amountMicroAlgos: 50n}),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );

    // accounts balance shouldn't be changed
    syncAccounts();
    assert.equal(john.balance(), johnBal);
    assert.equal(bob.balance(), bobBal);
  });
  ```

Full example with the above tests is available in our [basic-teal](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/basic-teal.ts) integration test suite.


### Stateful TEAL

Now, we will execute a transaction with an app call (stateful TEAL). The app is a simple smart contract which increments a global and local "counter" during each application call. Teal code can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/fixtures/stateful/assets/counter-approval.teal)

- Similar to the previous test, we need to setup accounts and initialize runtime. Now, for stateful smart contract, we also need to create a new application in user account and opt-in (to call the stateful smart contract later). User can use `runtime.addApp()` and `runtime.optInToApp()` for app setup.
  ```javascript
  const john = new AccountStoreImpl(1000);
  let runtime: Runtime;
  let program: string;

  const txnParams: ExecParams = {
    type: TransactionType.CallNoOpSSC,
    sign: SignType.SecretKey,
    fromAccount: john.account,
    appId: 0,
    payFlags: { totalFee: fee }
  };

  this.beforeAll(async function () {
    runtime = new Runtime([john]); // setup test
    program = getProgram('counter-approval.teal');

    // create new app
    txnParams.appId = await runtime.addApp({
      sender: john.account,
      globalBytes: 32,
      globalInts: 32,
      localBytes: 8,
      localInts: 8
    }, {}, program);

    // opt-in to the app
    await runtime.optInToApp(txnParams.appId, john.address, {}, {}, program);
  });
  ```

- After set up, let's call the stateful smart contract and check the updated global state
  ```javascript
  const key = "counter";
  it("should set global and local counter to 1 on first call", function () {
    runtime.executeTx(txnParams);

    const globalCounter = runtime.getGlobalState(txnParams.appId, key);
    assert.equal(globalCounter, 1n);

    const localCounter = runtime.getAccount(john.address).getLocalState(txnParams.appId, key); // get local value from john account
    assert.equal(localCounter, 1n);
  });
  ```
  In this test, after executing a transaction with stateful smart contract call, we are verifying if the `global state` and `local state` are updated correctly. User can use `runtime.getGlobalState()` and `runtime.getLocalState()` to check state.

Please look at [stateful-counter.ts](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/stateful-counter.ts) to see the complete integration test suite.


## Best Practices

- Follow the Test Structure section to setup your tests.
- Structure tests using AAA pattern: Arrange, Act & Assert (AAA). The first part includes the test setup, then the execution of the unit under test, and finally the assertion phase. Following this structure guarantees that the reader will quickly understand the test plan.
- To prevent test coupling and easily reason about the test flow, each test should add and act on its own set of states.
- Use `beforeEach`, `afterEach`, `beforeAll`, `afterAll` functions to setup and clean shared resources in your tests.
- Sync your accounts' before checking their state.

## What we support now

Currently, `runtime` supports:

- Prepare account state for teal execution.
- Stateless TEAL - Approve/Reject logic.
- Stateful TEAL - Update and verify global/local states if teal logic is correct.
- Transactions to
  + [`create` an application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#create)
  + [`opt-in` to application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#opt-in)
  + [`call` application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#call-noop)
  + [`update` application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#update)
  + [`delete` application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#delete)
  + [`closeout` from an application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#close-out)
  + [`clearState` of application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#clear-state)
  + [`create` an asset](https://developer.algorand.org/docs/features/transactions/#create-an-asset)
  + [`opt-in` to asset](https://developer.algorand.org/docs/features/transactions/#asset-transfer-transaction)
  + [`transfer` an asset](https://developer.algorand.org/docs/reference/transactions/#asset-transfer-transaction)

- Full transaction processing for type `payment`, `application call`
- Asset related transactions:
    - [Asset Destroy](https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction)
    - [Asset Revoke](https://developer.algorand.org/docs/reference/transactions/#asset-clawback-transaction)
    - [Asset Freeze](https://developer.algorand.org/docs/reference/transactions/#asset-freeze-transaction)
    - [Asset Configuration](https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction)


## Examples

TEAL files used for the below tests can be found in `/test/fixtures` in [runtime](https://github.com/scale-it/algo-builder/tree/master/packages/runtime/test/fixtures) package.

+ [Boilerplate Stateless Teal](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/basic-teal.ts)
+ [Escrow Account Test](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/escrow-account.ts)
+ [Boilerplate Stateful Teal](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/stateful-counter.ts)
+ Complex TEAL test suite (Stateless + Stateful + Atomic transactions) - [Crowdfunding application](https://github.com/scale-it/algo-builder/tree/master/examples/crowdfunding/test)

See our [examples](https://github.com/scale-it/algo-builder/tree/master/examples) for more interesting test suites.
