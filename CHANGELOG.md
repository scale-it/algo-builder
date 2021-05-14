# CHANGELOG

## unreleased

### Breaking
* Removed Algob prefix in deployer (eg. renamed `AlgobDeployer` to `Deployer`)
* Updated `execParams` structure & typings (input parameters for `executeTransaction`)
    * Migration: If `SignType` is `LogicSignature` then change `fromAccount` to `fromAccountAddr` and just pass from address instead of complete account.
* Changed the way we pass arguments to stateless smart contract - moved assignment from when we load smart contract (using `loadLogic`, `mkDelegatedLsig`, `fundLsig`) to when we create transaction execution parameters.
    * Migration: assign stateless args in txParams to `executeTransaction`. Eg
        ```js
        await deployer.loadLogic('htlc.py', [arg1]); // remove scTmplParams from here
        const txnParams: rtypes.AlgoTransferParam = { .. }
        txnParams.args = [arg1]; // assign here now
        await executeTransaction(deployer, txnParams);
        ```

### Improvements
* Added more tests for the [crowdfunding example project](/examples/crowdfunding) using `@algo-builder/runtime`- Happy paths and Failing paths.
* Integrate user documentation with `jekyll`.
* Moved OptIn methods from *DEPLOY* mode to *RUN* mode.
* Added new function `signLogicSigMultiSig` to sign logic signature by multisig.
* Updated ASA deployment (`deployASA` function) to pass custom params and save deployed asset definition in checkpoint.
* Support deployment and optIn methods in a transaction group (along with all other methods, using `executeTransaction`)
* Renamed `loadBinaryMultiSig` to `loadBinaryLsig` (load signed logic signature from file in scripts)

### Commands
* `algob test` (runs mocha in project root).
* `algob unbox-template <name> <destination>` to quickly unbox a dapp template from `scale-it/algo-builder-templates`.
* `algob sign-multisig --account <acc> --file <input> --out <out-file>` to append user's signature to signed multisig file.
* `algob sign-lsig --account <acc> --file <input> --out <out-file>` to sign logic signature.

### Examples
* Added new templates:
    * [Permissioned Token](/examples/permissioned-token)
    * [stateful counter](/examples/stateful-counter)
* Updated [`examples/asa`](/examples/asa): added new use-case to deploy and control ASA by a smart contract.

### Dapp templates.
We created a new [repository](https://github.com/scale-it/algo-builder-templates) with dapp templates. It's a new project line of Algo Builder. Dapp Templates are webapps operating with Algorand blockchain with `algob` support. For the moment we only have React templates. Anyone can contribute with a new template or by improving the pre-existing ones by creating a pull request.

* [/default](https://github.com/scale-it/algo-builder-templates/tree/master/default) template (with ASA transfer functionality)
* [/htlc](https://github.com/scale-it/algo-builder-templates/tree/master/htlc) template - dapp implementing hash time locked contract.

### Infrastructure
* Added new make commands:
    * `setup-private-net` - create network, start network, setup master account and show network status
    * `recreate-private-net` - stop the current instance, remove all data and re-setup

### @algorand-builder/runtime:
* fixed bugs
    * in group tx flow
    * in opcodes: *asset_params_get*, *txn GroupIndex*, *concat*
    * closing asset using clawback should be denied

## v0.5.4 2021-03-15

Renaming the organization and package names to `@algo-builder`.

## v0.5.0 2021-03-08

General:
* Added documentation (in `/docs/testing-teal.md`) to test TEAL using `@algorand-builder/runtime`
* [breaking] Added support for ASA OptIn for contract account (eg. escrow) represented by logic signature. Changed `optInToASA` to `optInAcountToASA` (for optIn using account) and `optInLsigToASA` (for optIn using logic signature account).
* Use `bigint` for all numeric values in `runtime` and `algob` to support integers upto 64 bit(`uint64`).

@algorand-builder/runtime:
* Full support for asset related transaction (create, opt-in, transfer, modify, freeze, revoke, destroy)
* Support for group transactions

Infrastructure:
* Support Sandbox in `/infrastructure` to quickly set up the private net
* [breaking] Changed default network config and the private-net for compatibility with Sandbox:
    * port = 4001
    * token = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
* Updated the default token and endpoint port. For compatibility with Sandbox we use the sandbox token and port (4001) in all examples and sample project. If you run an algorand node using our private node setup then either recreate the network (stop, remove node_data and create it again), or update the `node_data/PrimaryNode/config.json` and set: `"EndpointAddress": "127.0.0.1:4001"`


## v0.4.0 2021-02-03

* Renamed `@algorand-builder/algorand-js` to `@algorand-builder/runtime`
* Added new example project - Crowdfunding Application
* `@algorand-builder/runtime`: added support for transactions: payment, app creation, opt-in, stateful (application call, clear, delete, close).
* Added support for arguments in stateful smart contracts similar to goal (eg. `str:abc`, 'int:12')
* Logic signature validation for stateless teal in runtime
* Introduced versioning of TEAL opcodes in runtime with max cost assertion
* Added a Typescript example project - `htlc-pyteal-ts`


## v0.3.0 2020-12-28

Moved package into `@algorand-builder` NPM organization. So all imports and install commands require to change `algob` to `@algorand-builder/algob`.

* Reproducible, declarative Algorand Network setup using scripts in `/infrastructure`.
* Re-organized examples. Now all examples share same config. Users are able to provide their own
* We ported all developer.algorand reference templates
* Reworked smart contract handling.
* API documentation improvements
* Added lot of new TypeScript [typings](https://github.com/scale-it/algorand-builder/tree/master/packages/types-algosdk) for `algosdk-js`

## v0.2.0 2020-11-25

* As a user I can compile and run PyTeal Files
* As a user I can access accounts from an ENV variable
* As a user I can load ALGOD and KMD credentials from ENV variable
* As a user I can load a multisig directly from /assets and execute transactions
* As a user I can use CLI to run an JS Node REPL with async/await suppport on the top level

### Breaking Changes

* `Deployer` smart-contracts API changes. Please refer to our [API documentation](https://scale-it.github.io/algorand-builder/interfaces/_types_.algobdeployer.html) to check available functions and attributes.


## v0.1 2020-09
