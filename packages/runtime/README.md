# [Algo Builder Runtime](https://algobuilder.dev/)

This package implements a light version of the go-algorand runtime. It allows to executes transactions and processes TEAL in JavaScript environment. The packages provides 4 main object:

- [Runtime](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/src/runtime.ts): handles transaction or txn group processing and state management . User can use a `Runtime` object to set up accounts, create applications, opt-in to app, update app, etc...
- [AccountStore](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/src/account.ts): user can create new accounts using a `AccountStore` object. All information about an account (`apps`, `assets`, `localState`, `globalState` etc..) is stored in `AccountStore`.
- [Parser](https://github.com/scale-it/algo-builder/tree/master/packages/runtime/src/parser): reads TEAL code and converts it to a list of opcodes which are executable by the interpreter. If a teal code contains an invalid opcode/data, parser will throw an error.
- [Interpreter](https://github.com/scale-it/algo-builder/tree/master/packages/runtime/src/interpreter): executes a list of opcodes returned by parser. Interpreter creates teal execution stack and interacts with runtime to perform changes related a TEAL code execution. At the end of execution, if the stack contains a single non-zero uint64 element then the teal code is approved, and transaction can be executed.

## Important links

- [Home Page](https://algobuilder.dev/)
- [Runtime API Docs](https://algobuilder.dev/api/runtime/index.html)
- [User Docs](https://algobuilder.dev/guide/README)

## Usage

`@algo-builder/runtime` can be included as a library using `yarn add @algo-builder/runtime` and then import it using `import * from '@algo-builder/runtime'`.

Please read more about usage of `runtime` from [here](https://scale-it.github.io/algo-builder/guide/testing-teal.html).

## What we support now

`runtime` supports:

- Prepare account state for teal execution.
- Stateless TEAL - Approve/Reject logic.
- Stateful TEAL - Update and verify global/local states if teal logic is correct.
- Transactions to

  - [`create` an application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#create)
  - [`opt-in` to application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#opt-in)
  - [`call` application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#call-noop)
  - [`update` application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#update)
  - [`delete` application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#delete)
  - [`closeout` from an application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#close-out)
  - [`clearState` of application](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#clear-state)
  - [`create` an asset](https://developer.algorand.org/docs/features/transactions/#create-an-asset)
  - [`opt-in` to asset](https://developer.algorand.org/docs/features/transactions/#asset-transfer-transaction)
  - [`transfer` an asset](https://developer.algorand.org/docs/reference/transactions/#asset-transfer-transaction)
  - [`rekey` an account](https://developer.algorand.org/docs/get-details/accounts/rekey/?from_query=rekey#create-publication-overlay)

- Full transaction processing for type `payment`, `application call`
- Asset related transactions:
  - [Asset Destroy](https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction)
  - [Asset Revoke](https://developer.algorand.org/docs/reference/transactions/#asset-clawback-transaction)
  - [Asset Freeze](https://developer.algorand.org/docs/reference/transactions/#asset-freeze-transaction)
  - [Asset Configuration](https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction)

STATUS: production ready.

## Contributing

Please read the main [README](https://github.com/scale-it/algo-builder/blob/master/README.md).
