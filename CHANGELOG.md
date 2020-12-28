# CHANGELOG

## unreleased

## v0.3.0 2020-12-28

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
