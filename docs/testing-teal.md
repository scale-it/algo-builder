# Testing TEAL

[TEAL](https://developer.algorand.org/docs/reference/teal/specification/) is a bytecode based stack language that executes inside Algorand transactions to check the parameters of the transaction and approve the transaction as if by a signature. `@algorand-builder/runtime` provides a lightweight runtime and TEAL interpreter to test Algorand Smart Contracts.

**NOTE:** TEAL can not modify nor create transactions, only reject or approve them. Approval is signaled by finishing with the stack containing a single non-zero uint64 value.

## How it works

`@algorand-builder/runtime` (JavaScript Algorand runtime) executes transactions and processes TEAL in 3 parts :-

- [Runtime](../packages/runtime/src/runtime.ts): For a transaction or txn group, the state management is handled by the `Runtime`. User can use `Runtime` object to set up accounts, create applications, opt-in to app, update app, etc...
- [StoreAccount](../packages/runtime/src/account.ts): User can create new accounts using the `StoreAccount` object. All information about account (`apps`, `assets`, `localState`, `globalState` etc..) is stored in `StoreAccount`.
- [Parser](../packages/runtime/src/parser): Reads TEAL code and converts it to a list of opcodes which are executable by the interpreter. If any opcode/data in teal code is invalid, parser will throw an error.
- [Interpreter](../packages/runtime/src/interpreter): Executes the list of opcodes returned by parser and updates stack after each execution. At the end of execution, if the stack contains a single non-zero uint64 element then the teal code is approved, and transaction can be executed.

## Block Rounds/Height
In runtime User can decide the round for each transaction or group of transactions. By default round is set to `2`.
Block rounds for runtime can be set by using `runtime.setRound(round)`. We can retrieve the current round by using `runtime.getRound()` function.<br />
Example:

      runtime.setRound(5); // set current round to 5
This means that current round is set to 5 and transaction will pass only if its' first valid round is less or equal 5 and the last valid round is greater than 5.
Note: Block round remains same until user changes it by calling `runtime.setRound(round)`.

## Flow of Testing
In this section we will describe the flow of testing smart contracts in runtime:
- Prepare Accounts: First of all we will create accounts using `StoreAccount`.

      const john = new StoreAccount(initialAlgo);
      const bob = new StoreAccount(initialAlgo);
  `initialAlgo`: To set up accounts we can pass the amount of algos we want to have in it.
- Prepare Runtime: After creating accounts we will create a runtime object with those accounts.

      const runtime = new Runtime([john, bob]);
- Set Rounds: Now we will set the rounds according to our requirement.

      runtime.setRound(20);
- Create Apps/Assets: At this point our runtime is ready. Now we can create apps and/or assets and begin testing our smart contracts (present in your current directory's `asset` folder). For creating a stateful application, use `runtime.addApp()` funtion. Similarly for creating a new asset we can use `runtime.addAsset()` function.
- Create and Execute Transactions: now we will create transactions to test our smart contracts. Use `runtime.executeTx()` funtion to execute transaction (Payment Transaction, Atomic Transfers, Asset Transfer etc...).
- Update/Refresh State: Please note that after a transaction is executed the state of an account will be updated. In order to inspect a new state of accounts we need to re-query them from the runtime. We usually create a `syncAccounts()` closure function which will reassign accounts to their latest state.
- Verify State: Now, we can verify our state, we will assert if updated state is correct.
  we can verify if the `global state` and `local state` is updated. we can use `runtime.getGlobalState()` and `runtime.getLocalState()` to check state.

## Run tests
In this section we will demonstrate executing transactions with stateless and stateful teal.

### Stateless TEAL

Let's try to execute a transaction where a user (say `john`) can withdraw funds from an `escrow` account based on a stateless smart contract logic. TEAL code can be found [here](../packages/runtime/test/fixtures/escrow-account/assets/escrow.teal).
- First let's set up the state: initialize accounts, get the logic signature for escrow using `runtime.getLogicSig()` function and set up runtime (snippet from mocha test is also provided below).
  ```
  const john = new StoreAccountImpl(500, johnAccount); // 0.005 ALGO
  const runtime = new Runtime([john]); // setup runtime
  const lsig = runtime.getLogicSig(getProgram('escrow.teal'), []);
  const escrow = runtime.getAccount(lsig.address());
  ```

- Execute transaction (using `runtime.executeTx()`) with valid txnParams.
  ```
  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.LogicSignature;
    fromAccount: escrow.account,
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
  In test, we are first checking the initial balance which we set during initialization. Then we are executing transaction by passing `txnParams`. After execution, we are verifying the account balances if the funds are withdrawn from `escrow`.

- Executing transaction with invalid txnParams results in failure.
  ```
  it("should reject transaction if amount > 100", async function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 500;

    // execute transaction (should fail as amount = 500)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams),
      ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });
  ```

Full mocha test with more transactions can be found [here](../packages/runtime/test/integration/escrow-account.ts).

### Stateful TEAL

Now, we will execute a transaction with stateful TEAL (which increments a global and local "counter" by on each application call). Teal code can be found [here](../packages/runtime/test/fixtures/stateful/assets/counter-approval.teal)

- Similar to the previous test, we need to setup accounts and initialize runtime. Now, for stateful smart contract, we also need to create a new application in user account and opt-in (to call the stateful smart contract later). User can use `runtime.addApp()` and `runtime.optInToApp()` for app setup.
  ```
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
  ```
  const key = "counter";
  it("should initialize global and local counter to 1 on first call", async function () {
    // execute transaction
    await runtime.executeTx(txnParams);

    const globalCounter = runtime.getGlobalState(txnParams.appId, base64ToBytes(key));
    assert.isDefined(globalCounter); // there should be a value present with key "counter"
    assert.equal(globalCounter, BIGINT1);

    const localCounter = runtime.getLocalState(txnParams.appId, base64ToBytes(key)); // get local value from john account
    assert.isDefined(localCounter); // there should be a value present in local state with key "counter"
    assert.equal(localCounter, BIGINT1);
  });
  ```
  In this test, after executing the transaction (stateful smart contract call), we are verifying if the `global state` and `local state` is updated. User can use `runtime.getGlobalState()` and `runtime.getLocalState()` to check state.

Complete test can be found [here](../packages/runtime/test/integration/stateful-counter.ts).

## Best Practices
- Follow Flow of Testing section to set up your tests.
- Structure tests by the AAA pattern: Structure your tests with 3 well-separated sections: Arrange, Act & Assert (AAA). The first part includes the test setup, then the execution of the unit under test, and finally the assertion phase. Following this structure guarantees that the reader spends no brain CPU on understanding the test plan.
- To prevent test coupling and easily reason about the test flow, each test should add and act on its own set of states.
- Use `beforeEach` and `afterEach` functions to set clear boundaries while testing.
- Sync your accounts's state after execution of each transaction.

## What we support now

Currently, `runtime` supports:

- Prepare account state for teal execution.
- Stateless TEAL - Approve/Reject logic.
- Stateful TEAL - Update and verify global/local states if teal logic is correct.
- Transactions to
  + `create` an application
  + `opt-in` to application
  + `update` application
  + `delete` application
  + `closeout` from an application
  + `clearState` of application
  + `create` an asset
  + `opt-in` to asset
  + `transfer` an asset

- Full transaction processing for type `payment`, `application call`

Currently `runtime` does not support :-

 - Asset related transactions:
    - Asset Destroy
    - Asset Revoke
    - Asset Freeze
    - Asset Configuration


## Examples

Teal files used for the below tests can be found in `/test/fixtures` in `runtime`.

+ [Boilerplate Stateless Teal](../packages/runtime/test/integration/basic-teal.ts)
+ [Escrow Account](../packages/runtime/test/integration/escrow-account.ts)
+ [Boilerplate Stateful Teal](../packages/runtime/test/integration/stateful-counter.ts)
+ Complex Teal (Stateless + Stateful + Atomic transactions) - [Crowdfunding application](../examples/crowdfunding)
