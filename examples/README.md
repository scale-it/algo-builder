# Repository of verified smart contract templates

Algo Builder team maintains this repository of of verified smart contract templates which will speedup your dapp design and development process.

## Templates

- [JS] [asa](./asa): a project that demonstrates how to create and manage Algorand Standard Assets (ASA).
- [JS] [bond](./bond): fixed interest rate token, modelled based on corporate bonds.
- [JS] [crowdfunding](./crowdfunding): crowdfunding smart contract based on [tutorial](https://developer.algorand.org/solutions/example-crowdfunding-stateful-smart-contract-application/).
- [JS] [DAO](./dao): template to create, manage and participate in a DAO.
- [JS] [multisig](./multisig): demonstration of creating a logic signature (lsig) signed by multiple accounts.
- [JS] [nft](./nft): Non-Fungible-Token using stateful TEAL.
- [JS] [permissioned voting](./permissioned-voting): a Permissioned Voting smart contract. [tutorial](https://developer.algorand.org/solutions/example-permissioned-voting-stateful-smart-contract-application/).
- [JS] [permissioned token - approach with unfreezing](./permissioned-token-freezing): a Permissioned Token template based on a freeze and unfreeze logic to transfer assets.
- [JS] [permissioned token](./permissioned-token): main template for creating Permissioned Tokens.
- [JS] [ref-templates](./ref-templates): best practices and templates using the Algorand reference smart contracts.
- [JS] [signed-txn](./signed-txn): demonstrates loading a serialized transaction from a file. A user can create a transaction and sign it (using `goal`) and send it to someone else to execute it in `algob`.
- [JS] [unique-nft](./unique-nft-asa) example of an ASA generation process based on a guaranteed unique parameter.

- [TS] [htlc](./htlc-pyteal-ts): a Hash-Time-Lock-Contract Example using PyTeal. In this project we transpile TypeScript files to JavaScript using `algob`.

## Interesting Test Suites

- [Runtime Test] [atomic transfer](../packages/runtime/test/integration/atomic-transfer.ts): tests demonstrating how to do atomic transfers.
- [Runtime Test] [loop](../packages/runtime/test/integration/loop.ts): demonstrates how to use loop.
- [Runtime Test] [fibonacci](../packages/runtime/test/integration/sub-routine.ts): demonstrates fibonacci implementation in teal using sub-routines.
- [Runtime Test] [shared space](../packages/runtime/test/integration/shared-space.ts): demonstrates shared space between transactions in a group.

## Setup

In this section we describe a common instructions for all examples.

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

- Many examples are using PyTEAL. Please follow our [PyTEAL setup](https://github.com/scale-it/algo-builder/blob/master/examples/README.md#pyteal).
- For passing template parameters dynamically in PyTEAL contract you will need to add [`algobpy`](https://github.com/scale-it/algo-builder/tree/master/examples/algobpy) in your project directory. Read more about usage of `algoby` and passing template parameters in /scripts [here](https://github.com/scale-it/algo-builder/blob/master/docs/guide/py-teal.md#external-parameters-support)

### Update config

We created one config file for all examples in this repository. To use customize it:
copy the `/examples/algob.confg-template.js` to `/examples/algob.config-local.js` and update
the following positions in the latter file:

- `master-account`: must be an account with some ALGOs - it will be used for deployment and for activating / funding other accounts.
