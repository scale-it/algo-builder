# Runtime

This package implements a light version of Algorand runtime. It allows to executes transactions and processes TEAL in JavaScript environment. The packages provides 4 main object:

- [Runtime](./src/runtime.ts): handles transaction or txn group processing and state management . User can use a `Runtime` object to set up accounts, create applications, opt-in to app, update app, etc...
- [AccountStore](./src/account.ts): user can create new accounts using a `AccountStore` object. All information about an account (`apps`, `assets`, `localState`, `globalState` etc..) is stored in `AccountStore`.
- [Parser](./src/parser): reads TEAL code and converts it to a list of opcodes which are executable by the interpreter. If a teal code contains an invalid opcode/data, parser will throw an error.
- [Interpreter](./src/interpreter): executes a list of opcodes returned by parser. Interpreter creates teal execution stack and interacts with runtime to perform changes related a TEAL code execution. At the end of execution, if the stack contains a single non-zero uint64 element then the teal code is approved, and transaction can be executed.

## Documentation

+ [Home Page](https://scale-it.github.io/algo-builder)
+ [Algob API Docs](../algob/README)
+ [User Docs](../../guide/README)

## Usage

`@algo-builder/runtime` can be included as a library using `yarn add @algo-builder/runtime` and then import it using `import * from '@algo-builder/runtime'`.

Please read more about usage of `runtime` from [here](../../docs/testing-teal.md).

## What we support now

`runtime` supports:

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

STATUS: production ready.

## Coming Soon

TEAL v3 Support

## Contributing

Please read the main [README](https://github.com/scale-it/algo-builder/blob/master/README.md).
