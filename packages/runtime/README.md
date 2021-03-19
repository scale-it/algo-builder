# Runtime

This package (JavaScript Algorand runtime) executes transactions and processes TEAL in 3 parts :-

- [Runtime](../packages/runtime/src/runtime.ts): For a transaction or txn group, the state management is handled by the `Runtime`. User can use `Runtime` object to set up accounts, create applications, opt-in to app, update app, etc...
- [StoreAccount](../packages/runtime/src/account.ts): User can create new accounts using the `StoreAccount` object. All information about account (`apps`, `assets`, `localState`, `globalState` etc..) is stored in `StoreAccount`.
- [Parser](../packages/runtime/src/parser): Reads TEAL code and converts it to a list of opcodes which are executable by the interpreter. If any opcode/data in teal code is invalid, parser will throw an error.
- [Interpreter](../packages/runtime/src/interpreter): Executes the list of opcodes returned by parser and updates stack after each execution. At the end of execution, if the stack contains a single non-zero uint64 element then the teal code is approved, and transaction can be executed.

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