# Creating a private-net (local development network)

This directory (`/infrastructure`) provides an example setup for a private-net, which you can use for local testing. It creates a single node, fully functional Algorand blockchain with:

* one wallet: `Wallet1`
* one address full of Algos (100% of total supply). We call that account a `master-account`.

Use `make` to run tasks to `create`, `start-private-net`, `stop-private-net`.

If you want to create a local network by your own, you can use a private net [tutorial](https://developer.algorand.org/tutorials/create-private-network/).

## Quick start

1. Install latest Algorand node. Use on of the options described in [algorand run-a-node](https://developer.algorand.org/docs/run-a-node/setup/install/)  documentation.
1. Make sure the algorand node is installed correctly and disable algorand service if you installed algorand node using a package:

        algod -v
        [optional] systemctl stop algod

1. Clone this repository
1. Then:

        cd infrastructure
        make create-private-net

1. Check the access token and network address. You will need them in your config file to correctly connect to a node. The network configuration (PrimaryNode/config.json) and token created using the `make create-private-net` command is fixed and shared in this repository, to match the one used in examples and default `algob.config`. Don't expose the node externally. Otherwise you will need to setup a firewall and generate a new token. You can see the network and a port by opening the following files:

        cat node_data/PrimaryNode/algod.net
        cat node_data/PrimaryNode/algod.token

1. To start and stop the the chain use the following commands:

        make start-private-net
        make stop-private-net

1. To set up master account (the account with hardcoded key we use in all our examples):

        make setup-master-account


## Connecting to algob

We can connect to an `algob` node either using `goal` command or REST. `goal` is only able to use a local node (need to have an access to the node data directory). So each use of `goal` will require specifying `--datadir` flag or `ALGORAND_DATA` environment variable. It's useful to define the former one (we are doing it in the Makefile):

    export ALGORAND_DATA=`pwd`/node_data/PrimaryNode

To connect from SDK or REST we need to know the network address and authorization token. This are stored in:

    cat $ALGORAND_DATA/algod.net
    cat $ALGORAND_DATA/algod.token

### Example REST requests

Private Net

    curl http://$(cat $ALGORAND_DATA/algod.net)/v1/block/31538 -H "X-Algo-API-Token: $(cat $ALGORAND_DATA/algod.token)"

Purestake:

    curl -X GET "https://testnet-algorand.api.purestake.io/ps1/versions" -H "x-api-key:<api-key>"

## KMD

KMD is not started by default (with `make start-private`). You need to run it separately with `make start-kmd`. Similarly to `algob`, we can check the running kmd network address and token in the following files:

    cat $ALGORAND_DATA/kmd-v<version>/kmd.net
    cat $ALGORAND_DATA/kmd-v<version>/kmd.token
