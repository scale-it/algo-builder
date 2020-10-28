# Algob Console

Sometimes it's nice to work with your contracts interactively for testing and debugging purposes, getting network config, paths, or for executing transactions by hand. 

`algob` provides you an easy way to do this via an interactive console, with your contracts available and ready to use.

## Usage

* To open console session run `yarn run algob console`
* To select network add `--network networkName` in command.(eg. `yarn run algob console --network localhost`)
* To exit `algob console` type `.exit`, `ctrl + D` or `ctrl + C` (twice). 

## Globals

Following globals are available in an `algob console` REPL:
* `deployer` : algob deployer in run mode. User can access checkpoints, get logic signature, transferAlgos and all other functions supported by `algob deployer`.
* `algodClient` : `algosdk.Algodv2`- an instance of algorand driver based on the current network (default if `--network` flag is not passed).
* `algosdk` : User can access `algosdk` package functions using this object. (eg. `algosdk.encodeAddress(..)`)  
* `algob` : all`algob` [exported](https://github.com/scale-it/algorand-builder/blob/master/packages/algob/src/index.ts) functions (eg. `algob.mkAccounts(..)`, `algob.balanceOf(..) etc)`