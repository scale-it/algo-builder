# Runtime

This package implements a light version of Algorand runtime. It allows to executes transactions and processes TEAL in JavaScript environment. The packages provides 4 main object:

- [Runtime](../packages/runtime/src/runtime.ts): handles transaction or txn group processing and state management . User can use a `Runtime` object to set up accounts, create applications, opt-in to app, update app, etc...
- [StoreAccount](../packages/runtime/src/account.ts): user can create new accounts using a `StoreAccount` object. All information about an account (`apps`, `assets`, `localState`, `globalState` etc..) is stored in `StoreAccount`.
- [Parser](../packages/runtime/src/parser): reads TEAL code and converts it to a list of opcodes which are executable by the interpreter. If a teal code contains an invalid opcode/data, parser will throw an error.
- [Interpreter](../packages/runtime/src/interpreter): executes a list of opcodes returned by parser. Interpreter creates teal execution stack and interacts with runtime to perform changes related a TEAL code execution. At the end of execution, if the stack contains a single non-zero uint64 element then the teal code is approved, and transaction can be executed.

## Usage

`@algo-builder/runtime` can be included as a library using `yarn add @algo-builder/runtime` and then import it using `import * from '@algo-builder/runtime'`.

Please read more about usage of `runtime` from [here](../../docs/testing-teal.md).

## What we support now

`runtime` supports:

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
- Asset related transactions:
    - Asset Destroy
    - Asset Revoke
    - Asset Freeze
    - Asset Configuration

STATUS: production ready.

## Contributing

Please read the main [README](https://github.com/scale-it/algo-builder/blob/master/README.md).
