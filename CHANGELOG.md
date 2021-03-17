# CHANGELOG

## unreleased

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
