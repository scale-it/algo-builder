# Common Setup

This file provides common instructions for all examples.

## Setup

### Create your local network:
https://developer.algorand.org/tutorials/create-private-network/

### Start whole network:
```
goal network start -r ~/.algorand-local/
```

### Start/stop a single node:
```
goal node start -d ~/.algorand-local/Node/
```

### Install dependencies

All dependencies are managed by `npm` / `yarn`. To install:

    yarn install

If want to use a development version of `algob`, you can use `yarn link`:

    yarn remove @algorand-builder/algob
    yarn link @algorand-builder/algob


After that, `algob` will be in your local yarn context. To use it we either access `algob` through `yarn run` (recommended), or through `node_modules/.bin`.

The examples are already initialized. So we don't need to run `yarn run algob init .`

#### PyTEAL

Many examples are using PyTEAL. Please follow our [PyTEAL setup](../README.md#pyteal).

### Update config

We created one config file for all examples in this repository. To use customize it:
copy the `/examples/algob.confg-template.js` to `/examples/algob.config-local.js` and update
the following positions in the latter file:

+ `master-account`: must be an account with some ALGOs - it will be used for deployment and for activating / funding other accounts.

### Examples Description

- [asa](./asa) - This `javascript` project shows how to create Algorand Standard Asset (ASA).
- [crowdfunding](./crowdfunding) - This `javascript` project demonstrates how to create a Crowdfunding Stateful Smart Contract Application. It's based on a [tutorial](https://developer.algorand.org/solutions/
- [multisig](./multisig) - This `javascript` example demonstrates authorizing transactions based on logic signature signed by multiple accounts.
- [nft](./nft) - Non-Fungible-Token Example using stateful TEAL in `javascript`. In this example, we create a new non-fungible-token represented by a name and a ref.
- [permissioned-voting](./permissioned-voting) -  This `javascript` project demonstrates how to create a Permissioned Voting Stateful Smart Contract Application.
Original tutorial can be found [here](https://developer.algorand.org/solutions/example-permissioned-voting-stateful-smart-contract-application/)
- [ref-templates](./ref-templates) - The goal of this project is to present how to work with ASC in `algob` using the best practices and templates using the Algorand reference templates.This is a `javascript` project.
- [signed-txn](./signed-txn) - This example demonstrates executing a serialized transaction loaded directly from a file. A user can create a transaction and sign it (using `goal`) and send it to someone else to execute it. This is a `javascript` project.
- [htlc](./htlc-pyteal-ts) - Hash-Time-Lock-Contract Example in `typescript` using PyTeal.
This is a `typescript` project therefore it requires a compilation to `js` files.
In this project we are transpiling the files in `js` and then using them with `algob`.