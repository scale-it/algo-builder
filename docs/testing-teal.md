# Testing TEAL

[TEAL](https://developer.algorand.org/docs/reference/teal/specification/) is a bytecode based stack language that executes inside Algorand transactions to check the parameters of the transaction and approve the transaction as if by a signature. `@algorand-builder/runtime` provides a lightweight runtime and TEAL interpreter to test Algorand Smart Contracts.

**NOTE:** TEAL can not modify nor create transactions, only reject or approve them. Approval is signaled by finishing with the stack containing a single non-zero uint64 value.

## How it works

`@algorand-builder/runtime` (JavaScript Algorand runtime) executes transactions and processes TEAL in 3 parts :-

- [Runtime](../packages/runtime/src/runtime.ts): For a transaction or txn group, the state management is handled by the `Runtime`. User can use `Runtime` object to set up accounts, create applications, opt-in to app, update app, etc...
- [StoreAccount](../packages/runtime/src/account.ts): User can create new accounts using the `StoreAccount` object. All information about account (`apps`, `assets`, `localState` etc..) is stored in `StoreAccount`.
- [Parser](../packages/runtime/src/parser): Reads TEAL code and converts it to a list of opcodes which are executable by the interpreter. If any opcode/data in teal code is invalid, parser will throw an error.
- [Interpreter](../packages/runtime/src/interpreter): Executes the list of opcodes returned by parser and updates stack after each execution. At the end of execution, if the stack contains a single non-zero uint64 element then the teal code is approved, and transaction can be executed.

## Run tests
In this section we will demonstrate executing transactions with stateless and stateful teal.

### Stateless TEAL

Let's try to execute a transaction where a user (say `john`) can withdraw funds from an `escrow` account based on a stateless smart contract logic. TEAL code can be found [here](../packages/runtime/test/fixtures/escrow-account/assets/escrow.teal).
- First let's set up the state: initialize accounts and set up runtime (snippet from mocha test is also provided below).
  ```
  const escrow = new StoreAccountImpl(1000e6); // 1000 ALGO
  const john = new StoreAccountImpl(500, johnAccount); // 0.005 ALGO
  const runtime = new Runtime([escrow, john]); // setup runtime
  ```

- Execute transaction (using `runtime.executeTx()`) with valid txnParams.
  ```
  // set up transaction paramenters
  const txnParams: ExecParams = {
    type: TransactionType.TransferAlgo, // payment
    sign: SignType.SecretKey,
    fromAccount: escrow.account,
    toAccountAddr: john.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 1000 }
  };

  it("should withdraw funds from escrow if txn params are correct", async function () {
    // check initial balance
    assert.equal(escrow.balance(), initialEscrowHolding);
    assert.equal(john.balance(), initialJohnHolding);

    // execute transaction
    await runtime.executeTx(txnParams, getProgram('escrow.teal'), []);

    // check final state (updated accounts)
    assert.equal(getAcc(runtime, escrow).balance(), initialEscrowHolding - 100); // check if 100 microAlgo's are withdrawn
    assert.equal(getAcc(runtime, john).balance(), initialJohnHolding + 100);
  });
  ```
  In test, we are first checking the initial balance which we set during initialization. Then we are executing transaction by passing `txnParams, teal code (as a string), external arguments to smart contract`. After execution, we are verifying the account balances if the funds are withdrawn from `escrow`.

- Executing transaction with invalid txnParams results in failure.
  ```
  it("should reject transaction if amount > 100", async function () {
    const invalidParams = Object.assign({}, txnParams);
    invalidParams.amountMicroAlgos = 500;

    // execute transaction (should fail as amount = 500)
    await expectTealErrorAsync(
      async () => await runtime.executeTx(invalidParams, getProgram('escrow.teal'), []),
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
    await runtime.executeTx(txnParams, program, []);

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
- Full transaction processing for type `payment` (transfer amount between accounts).

Currently `runtime` does not support :-

 - Full transaction processing for txn types other than 'pay' (`asset transfer`, `asset freeze` etc)
 - Transactions to
   + `create` an asset
   + `opt-in` to asset


## Examples

Teal files used for the below tests can be found in `/test/fixtures` in `runtime`.

+ [Boilerplate Stateless Teal](../packages/runtime/test/integration/basic-teal.ts)
+ [Escrow Account](../packages/runtime/test/integration/escrow-account.ts)
+ [Boilerplate Stateful Teal](../packages/runtime/test/integration/stateful-counter.ts)
+ Complex Teal (Stateless + Stateful + Atomic transactions) - [Crowdfunding application](../examples/crowdfunding)
