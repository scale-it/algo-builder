# CHANGELOG

## unreleased

### API breaking
* Move `updateSSC` function to `deployer`
+ Rename `parseArgs` to `parse_params`

### Improvements
+ Replaced dependency `find-up` with `findup-sync` in `algob`.
+ Added `algopy` in `@algo-builder/algob/sample-project`, which enables users to pass template parameters to PyTEAL contracts. Updated docs.

### Bug fixes

`@algorand-builder/runtime`
    * Remove asset holding from account if `closeRemainderTo` is specified.
    * Asset creator should not be able to close it's holding to another account.

## v1.0.2 2021-05-18

### Improvements
* Update how error is displayed to a user
* Add Update stateful smart contracts using execute transaction in runtime
* Store checkpoints in nested form for SSC, added tests.

Runtime:
+ added `updateApp` method.

### Bug fixes

+ Added missing dependency: `find-up`


## v1.0.1 2021-05-16

* Fixed dependency for `@algo-builder/algob`.


## v1.0 2021-05-14

New website: https://scale-it.github.io/algo-builder

### API breaking
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
* Integrated user documentation with `jekyll`.
* Added new function `signLogicSigMultiSig` to sign logic signature by multisig.
* Updated ASA deployment (`deployASA` function) to pass custom params and save deployed asset definition in checkpoint.
* Support deployment and optIn methods in a transaction group (along with all other methods, using `executeTransaction`).
* Renamed `loadBinaryMultiSig` to `loadBinaryLsig` (load signed logic signature from file in scripts).
* New opt-in functions and updates. Check the [deployer API](https://scale-it.github.io/algo-builder/api/algob/interfaces/types.deployer.html) for information about all opt-in functions.
  * `deployer.optIn` are now available both in *DEPLOY* mode to *RUN* mode.
  * Extended `deployer.optIn*` functions to support ASA by ID. Previously we only accepted ASA by name (based on the name in `assets/asa.yaml` file).
  * Added [`deployer.optInLsigToSSC`](https://scale-it.github.io/algo-builder/api/algob/interfaces/types.deployer.html#optinlsigtossc) and [`deployer.optInLsigToASA`](https://scale-it.github.io/algo-builder/api/algob/interfaces/types.deployer.html#optinlsigtoasa) to easily opt-in stateless smart contract (lsig) account to stateful smart contract and ASA.
* Asset related `execParams` (transaction parameters for [`executeTransaction`](https://scale-it.github.io/algo-builder/api/algob/modules.html#executetransaction)) support ASA by name and by ID (previously only ASA ID was supported). [Example](https://github.com/scale-it/algo-builder/blob/master/examples/asa/scripts/transfer/gold-delegated-lsig.js#L22).
* cleaned test suite log (when developing Algo Builder itself). Our test suite has 884 tests.

### Commands
We added new commands:
* `algob test` (runs mocha in project root).
* `algob unbox-template <name> <destination>` to quickly unbox a dapp template from `scale-it/algo-builder-templates`.
* `algob sign-multisig --account <acc> --file <input> --out <out-file>` to append user's signature to signed multisig file using accounts managed by `algob`.
* `algob sign-lsig --account <acc> --file <input> --out <out-file>` to sign logic signature using accounts managed by `algob`.


### Examples
* Added new templates:
    * [Permissioned Token](/examples/permissioned-token)
    * [stateful counter](/examples/stateful-counter)
* Updated [`examples/asa`](/examples/asa): added new use-case to deploy and control ASA by a smart contract.


### Dapp templates.
* We created a new [repository](https://github.com/scale-it/algo-builder-templates) with dapp templates. It's a new project line of Algo Builder. Dapp Templates are webapps operating with Algorand blockchain with `algob` support. For the moment we only have React templates. Anyone can contribute with a new template or by improving the pre-existing ones by creating a pull request.
    * [/default](https://github.com/scale-it/algo-builder-templates/tree/master/default) template (with ASA transfer functionality)
    * [/htlc](https://github.com/scale-it/algo-builder-templates/tree/master/htlc) template - dapp implementing hash time locked contract.
* Added `algob unbox-template` command to download a template and setup the project.


### Infrastructure
* Added new make commands:
    * `setup-private-net` - creates and starts private network, setups master account and shows network status.
    * `recreate-private-net` - stops and removes the private network, and re-setup.


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
