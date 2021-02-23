# CHANGELOG

## unreleased

+ Updating the default token and endpoint port. For compatibility with Sandbox we use the sandbox token and port (4001) in all examples and sample project. If you have your run an algorand node using our private node setup then either recreate the network (stop, remove node_data and create it again), or update the `node_data/PrimaryNode/config.json` and set: `"EndpointAddress": "127.0.0.1:4001"`


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
