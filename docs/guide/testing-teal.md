---
layout: splash
---

# Testing TEAL

[TEAL](https://developer.algorand.org/docs/reference/teal/specification/) is a bytecode based stack language that executes inside Algorand transactions to check the parameters of the transaction and approve the transaction as if by a signature. `@algo-builder/runtime` provides a lightweight runtime and TEAL interpreter to test Algorand Smart Contracts.

**NOTE:** TEAL can not modify nor create transactions, only reject or approve them. Approval is signaled by finishing with the stack containing a single non-zero uint64 value.

## How it works

`@algo-builder/runtime` (JavaScript Algorand runtime) executes transactions and processes TEAL in 3 parts :-

- [Runtime](https://scale-it.github.io/algo-builder/api/runtime/classes/runtime.html): process transaction or txn group, and manages state. `algob` user interacts directly with `Runtime` to set up accounts and post transactions (create applications, upate application, opt-in to app, ASA ...).
- [AccountStore](https://scale-it.github.io/algo-builder/api/runtime/classes/accountstore.html): `AccountStore` object represents an Alogrand compatible account, which stores all account related information (`apps`, `assets`, `localState`, `globalState` etc..).
- [Parser](https://scale-it.github.io/algo-builder/api/runtime/modules.html#parser): parses TEAL code and returns a list of opcodes which are executable by the `Interpreter`. If any opcode/data in teal code is invalid, parser will throw an error.
- [Interpreter](https://scale-it.github.io/algo-builder/api/runtime/classes/interpreter.html): Executes the list of opcodes returned by the parser and updates `Runtime` current transaction context after each opcode execution. At the end of execution, if the execution stack contains a single non-zero uint64 element then the teal code is approved, and and current transaction context is committed. If transaction is executed in a group context, then the state commit only happens if all transactions in the group pass.


## Block Rounds/Height

In Algorand blockchain, transaction processing divided into rounds. At each round blocchain creates a block with transactions which update the state. All transactions in the same block has the same transaction time and block height.
In Alogrand Builder Runtime, we don't have blocks. All transactions are processed immediately.
However, we keep the notion of rounds and timestamps because it is needed for transaction and smart contract processing.

The default Runtime block round is set to `2` and timestamp to `1`. Runtime doesn't change the block round or timestamp - it's up to the user to set in when designing a test flow. To change the block round and timestamp we need to call `runtime.setRoundAndTimestamp(round, timestamp)`. We can retrieve the current block round and timestamp using `runtime.getRound()` and `runtime.getTimestamp()` respectively. <br />
Example:

    runtime.setRoundAndTimestamp(5, 10); // set current block round to 5 and timestamp to 10

This means that current block round is set to 5 and transaction will pass only if its' first valid round is less or equal 5 and the last valid round is greater than 5.
Note: Block round and timestamp remains same until user will change it again.


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
In this section we will demonstrate executing transactions with stateless and stateful teal.

TL;DR: Write tests in `/test` directory and then call `mocha`:

    mocha <test name>

or you can also run tests using algob

    algob test

See one of our examples for more details (eg: `examples/crowdfunding/test`).


### Stateless TEAL

#### Escrow Account

Let's try to execute a transaction where a user (say `john`) can withdraw funds from an `escrow` account based on a stateless smart contract logic. In the example below, we will use a TEAL code from our [escrow account test](../packages/runtime/test/fixtures/escrow-account/assets/escrow.teal).
- First let's prepare the runtime and state: initialize accounts, get a logic signature for escrow and set up runtime:
  ```js
  const john = new StoreAccount(initialJohnHolding);
  const runtime = new Runtime([john]); // setup runtime
  const lsig = runtime.getLogicSig(getProgram('escrow.teal'), []);
  const escrow = runtime.getAccount(lsig.address());
  ```

- Execute transaction (using `runtime.executeTx()`) with valid txnParams.
  ```ts
  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.LogicSignature;
    fromAccountAddr: escrow.address,
    toAccountAddr: john.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 1000 },
    lsig: lsig
  };

  it("should withdraw funds from escrow if txn params are correct", async function () {
    // check initial balance
    assert.equal(escrow.balance(), initialEscrowHolding);
    assert.equal(john.balance(), initialJohnHolding);

    // execute transaction
    await runtime.executeTx(txnParams);

    // check final state (updated accounts)
    assert.equal(getAcc(runtime, escrow).balance(), initialEscrowHolding - 100); // check if 100 microAlgo's are withdrawn
    assert.equal(getAcc(runtime, john).balance(), initialJohnHolding + 100);
  });
  ```
  In this test, at the beginning, we  check the initial balance which - it shouldn't change (must be the same as during initialization). Then we execute transaction using `txnParams`. After execution, we are verify the account balances to check if the funds are withdrawn from `escrow`.

- Executing transaction with invalid txnParams results in failure.
  ```js
  it("should reject transaction if amount > 100", async function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 500;

    // execute transaction (should fail as amount = 500)
    await expectRuntimeErrorAsync(
      async () => await runtime.executeTx(invalidParams),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });
  ```

Full mocha test with more transactions can be found [here](../packages/runtime/test/integration/escrow-account.ts).

#### Delegated Signuature Account

Let's try to execute a transaction where a user (say `john`) will use delegated signature based on a stateless smart contract logic. We will use a TEAL code from our [asset test](../packages/runtime/test/fixtures/basic-teal/assets/basic.teal).
  - As before we start with preparing the runtime. We use `runtime.getLogicSig(getProgram('escrow.teal'), [])` to create a logic signature.
    ```js
    const john = new StoreAccount(initialHolding);
    const bob = new StoreAccount(initialHolding)
    const runtime = new Runtime([john, bob]); // setup runtime
    const lsig = runtime.getLogicSig(getProgram('escrow.teal'), []);
    lsig.sign(john.account.sk);
    ```

  - Execute transaction:
    ```js
    // set up transaction paramenters
    const txnParams: ExecParams = {
      type: TransactionType.TransferAlgo, // payment
      sign: SignType.LogicSignature,
      fromAccountAddr: john.address,
      toAccountAddr: bob.address,
      amountMicroAlgos: 100,
      payFlags: { totalFee: 1000 }
    };

    it("should send algo's from john to bob if stateless teal logic is correct", function () {
      // check initial balance
      assert.equal(john.balance(), initialHolding);
      assert.equal(bob.balance(), initialHolding);
      // get logic signature
      const lsig = runtime.getLogicSig(getProgram('basic.teal'), []);
      lsig.sign(john.account.sk);
      txnParams.lsig = lsig;

      runtime.executeTx(txnParams);

      // get final state (updated accounts)
      const johnAcc = runtime.getAccount(john.address);
      const bobAcc = runtime.getAccount(bob.address);
      assert.equal(johnAcc.balance(), initialJohnHolding - 1100); // check if (100 microAlgo's + fee of 1000) are withdrawn
      assert.equal(bobAcc.balance(), initialBobHolding + 100);
    });
    ```
    In the test, we start with validating the initial balances. After executing the transactions, we are verifying the account balances to check if funds are withdrawn from `john` account.

  - Executing transaction with logic rejecting teal file results in failure.
    ```js
    it("should throw error if logic is incorrect", function () {
      // initial balance
      const johnBal = john.balance();
      const bobBal = bob.balance();
      // get logic signature
      const lsig = runtime.getLogicSig(getProgram('incorrect-logic.teal'), []);
      lsig.sign(john.account.sk);
      txnParams.lsig = lsig;

      const invalidParams = Object.assign({}, txnParams);
      invalidParams.amountMicroAlgos = 50;

      // execute transaction (should fail is logic is rejected)
      expectRuntimeError(
        () => runtime.executeTx(invalidParams),
        ERRORS.TEAL.REJECTED_BY_LOGIC
      );
    });
    ```

  Full mocha test with more transactions can be found [here](../packages/runtime/test/integration/basic-teal.ts).

### Stateful TEAL

Now, we will execute a transaction with stateful TEAL (which increments a global and local "counter" by on each application call). Teal code can be found [here](../packages/runtime/test/fixtures/stateful/assets/counter-approval.teal)

- Similar to the previous test, we need to setup accounts and initialize runtime. Now, for stateful smart contract, we also need to create a new application in user account and opt-in (to call the stateful smart contract later). User can use `runtime.addApp()` and `runtime.optInToApp()` for app setup.
  ```js
  const john = new StoreAccountImpl(1000);

  let runtime: Runtime;
  let program: string;
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

    // opt-in to app
    await runtime.optInToApp(txnParams.appId, john.address, {}, {}, program);
  });
  ```

- After set up, let's call the stateful smart contract and check the updated global state
  ```js
  const key = "counter";
  it("should initialize global and local counter to 1 on first call", async function () {
    // execute transaction
    await runtime.executeTx(txnParams);

    const globalCounter = runtime.getGlobalState(txnParams.appId, base64ToBytes(key));
    assert.isDefined(globalCounter); // there should be a value present with key "counter"
    assert.equal(globalCounter, 1n);

    const localCounter = runtime.getLocalState(txnParams.appId, base64ToBytes(key)); // get local value from john account
    assert.isDefined(localCounter); // there should be a value present in local state with key "counter"
    assert.equal(localCounter, 1n);
  });
  ```
  In this test, after executing the transaction (stateful smart contract call), we are verifying if the `global state` and `local state` is updated. User can use `runtime.getGlobalState()` and `runtime.getLocalState()` to check state.

Complete test can be found [here](../packages/runtime/test/integration/stateful-counter.ts).

## Best Practices
- Follow the Test Structure section to setup your tests.
- Structure tests using AAA pattern: Arrange, Act & Assert (AAA). The first part includes the test setup, then the execution of the unit under test, and finally the assertion phase. Following this structure guarantees that the reader will quickly understand the test plan.
- To prevent test coupling and easily reason about the test flow, each test should add and act on its own set of states.
- Use `beforeEach`, `afterEach`, `beforeAll`, `afterAll` functions to set clear boundaries while testing.
- Sync your accounts's state after execution of each transaction.

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

Teal files used for the below tests can be found in `/test/fixtures` in `runtime`.

+ [Boilerplate Stateless Teal](../packages/runtime/test/integration/basic-teal.ts)
+ [Escrow Account](../packages/runtime/test/integration/escrow-account.ts)
+ [Boilerplate Stateful Teal](../packages/runtime/test/integration/stateful-counter.ts)
+ Complex Teal (Stateless + Stateful + Atomic transactions) - [Crowdfunding application](../examples/crowdfunding)
