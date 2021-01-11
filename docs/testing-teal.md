# Testing TEAL

[TEAL](https://developer.algorand.org/docs/reference/teal/specification/) is a bytecode based stack language that executes inside Algorand transactions to check the parameters of the transaction and approve the transaction as if by a signature. `@algorand-builder/algorand-js` provides a simple workflow to execute TEAL code with high speed and throughput (as the transactions are not processed on the blockchain but in a test environment).

**NOTE:** TEAL cannot modify or create transactions, only reject or approve them. Approval is signaled by finishing with the stack containing a single non-zero uint64 value.

## How it works

`@algorand-builder/algorand-js` (JavaScript Algorand runtime) executes transactions and processes TEAL in 3 parts :-

- [Runtime](packages/algorand-js/src/runtime): For a transaction or txn group, the state management is handled by the `Runtime`. User can use `Runtime` class to set up accounts, create applications, opt-in to app, update app..etc
- [Parser](packages/algorand-js/src/parser): Reads TEAL code and converts it to a list of opcodes which are executable by the interpreter. If any opcode/data in teal code is invalid, parser will throw an error.
- [Interpreter](packages/algorand-js/src/interpreter): Executes the list of opcodes returned by parser and updates stack after each execution. After the end of execution, if top of stack contains a non-zero uint64 value then the teal code is approved, and transaction can be executed.

## Run tests
In this section we will demonstrating executing transactions with stateless and stateful teal.

### Stateless TEAL

Let's try to execute a transaction where the user (say `john`) can withdraw funds from an `escrow` account based on a stateless smart contract logic. Teal code can be found [here](packages/algorand-js/test/fixtures/escrow-account/assets/escrow.teal).
- First let's set up the state: initialize accounts and set up runtime (snippet from mocha test is also provided below).
```
const escrow = new StoreAccountImpl(1000e6); // 1000 ALGO
const john = new StoreAccountImpl(500, johnAccount); // 0.005 ALGO
const runtime = new Runtime([escrow, john]); // setup runtime
```
![image](https://user-images.githubusercontent.com/33264364/104197847-81afe200-544b-11eb-8553-b2446ea9c763.png)

- Execute transaction (using `runtime.executeTx()`) with valid txnParams.
![image](https://user-images.githubusercontent.com/33264364/104199023-f33c6000-544c-11eb-975b-1f8f72508ee6.png)
In test, we are first checking the initial balance which we set during initialization. Then we are executing transaction by passing `txnParams, teal code (as string), external arguments to smart contract`. After execution, we are verifying the account balances if the funds are withrawn from `escrow`.

- Executing transaction with invalid txnParams results in failure.
![image](https://user-images.githubusercontent.com/33264364/104201136-6cd54d80-544f-11eb-80ea-9ca307bc189d.png)

Full mocha test with more transactions can be found [here](packages/algorand-js/test/integration/escrow-account.ts).

### Stateful TEAL

Now, we will execute a transaction with stateful TEAL (which increments a global and local "counter" by on each application call). Teal code can be found [here](packages/algorand-js/test/fixtures/stateful/assets/counter-approval.teal)

- Similar to above test, we need to setup accounts and initialize runtime. Now, for stateful txn, we also need to create a new application in user account and also do opt-in (to call the stateful smart contract later). User can use `runtime.addApp()` and `runtime.optInToApp()` for app setup.
![image](https://user-images.githubusercontent.com/33264364/104204711-94c6b000-5453-11eb-99e5-f772ce4b5c92.png)

- After set up, let's call the stateful smart contract and check the updated global state
![image](https://user-images.githubusercontent.com/33264364/104205377-5382d000-5454-11eb-8b57-8a6690694c61.png)
In this test, after executing the transaction (call stateful smart contract), we are verifying if the `global state` and `local state` is updated. User can use `runtime.getGlobalState()` and `account.getLocalState()` to check state.

Complete test can be found [here](packages/algorand-js/test/integration/stateful-counter.ts).

## What we support now

Currently, `algorand-js` supports:

- Prepare account state for teal execution.
- Stateless TEAL - Approve/Reject logic.
- Stateful TEAL - Update and verify global/local states if teal logic is correct.
- Transactions to
  + `create` an application
  + `opt-in` to application
  + `update` application
  + `delete` application
- Full transaction processing for type `payment` (transfer amount between accounts).

Currently `algorand-js` does not support :-

 - Full transaction processing for txn types other than 'pay' (`asset transfer`, `asset freeze` etc)
 - Transactions to
   + `create` an asset
   + `opt-in` to asset


## Examples

Teal files used for the below tests can be found in `/test/fixtures` in `algorand-js`.

+ [Boilerplate Stateless Teal](packages/algorand-js/test/integration/basic-teal.ts)
+ [Escrow Account](packages/algorand-js/test/integration/escrow-account.ts)
+ [Boilerplate Stateful Teal](packages/algorand-js/test/integration/stateful-counter.ts)
+ Complex Teal (Stateless + Stateful + Atomic transactions) - [Crowdfunding application](examples/crowdfunding)