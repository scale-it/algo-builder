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

    yarn remove @algo-builder/algob
    yarn link @algo-builder/algob


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

- [JS][asa](./asa) - This project demonstrates how to create and manage Algorand Standard Assets (ASA).
- [JS][crowdfunding](./crowdfunding) - This project demonstrates how to create a Crowdfunding Stateful Smart Contract Application. It's based on a [tutorial](https://developer.algorand.org/solutions/example-crowdfunding-stateful-smart-contract-application/)
- [JS][multisig](./multisig) - This example demonstrates authorizing transactions based on logic signature signed by multiple accounts.
- [JS][nft](./nft) - Non-Fungible-Token Example using stateful TEAL. In this example, we create a new non-fungible-token represented by a name and a ref.
- [JS][permissioned-voting](./permissioned-voting) -  This project demonstrates how to create a Permissioned Voting Stateful Smart Contract Application.
Original tutorial can be found [here](https://developer.algorand.org/solutions/example-permissioned-voting-stateful-smart-contract-application/)
- [JS][ref-templates](./ref-templates) - The goal of this project is to present how to work with ASC in `algob` using the best practices and templates using the Algorand reference templates.
- [JS][signed-txn](./signed-txn) - This example demonstrates executing a serialized transaction loaded directly from a file. A user can create a transaction and sign it (using `goal`) and send it to someone else to execute it.
- [TS][htlc](./htlc-pyteal-ts) - Hash-Time-Lock-Contract Example using PyTeal.
In this project we are transpiling the files in `js` and then using them with `algob`.
