# Algob Console

Sometimes it's nice to work with your contracts interactively for testing and debugging purposes, getting network config, paths, or for executing transactions by hand. 

`algob` provides you an easy way to do this via an interactive console, with your contracts available and ready to use.

## Usage

To open console session run `yarn run algob console`

## Globals

Following globals can be accessed during `algob console` session
* `deployer` : algob deployer in run mode. User can access checkpoints, get logic signature, transferAlgos and all other functions supported by `algob deployer`.
* `algodClient` : `algosdk.Algodv2`- an instance of algorand driver based on the current network.
* `algosdk` : User can access `algosdk` package functions using this object. (eg. `algosdk.encodeAddress(..)`)  
* `algob` : User has access to `algob` functions as well. (eg. `algob.mkAccounts(..)`, `algob.balanceOf(..) etc)`