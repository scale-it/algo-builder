# Creating a private-net (local development network)

This directory (`/infrastructure`) provides an example setup for a private-net, which you can use for local testing. It creates a single node, fully functional Algorand blockchain with:

* one wallet: `Wallet1`
* one address full of Algos (100% of total supply). We call that account a `master-account`.

Use `make` to run tasks to `create`, `start-private-net`, `stop-private-net`.

NOTE: For Windows user, check this StackOverflow [thread](https://stackoverflow.com/questions/32127524/how-to-install-and-use-make-in-windows) on how to install `make`. As a workaround, you can always open Makefile in a text editor and copy paste the commands from required make job, directly to your terminal.


## Setting up a local node

### Quick start (local development network)

This is a guide to quickly start a local node using `algod` and make scripts.

**TL;DR**: **Make sure you have Algorand Node (`algod` and `goal`) and `make` installed**. Then `cd infrastructure; make setup-private-net`. To reset use `recreate-private-net`.

1. Install the latest Algorand node. Use one of the options described in the [Algorand installation](https://developer.algorand.org/docs/run-a-node/setup/install/)  documentation.
1. Make sure the algorand node is installed correctly. You can disable algorand service if you installed algorand node using a package:

        algod -v
        [optional] systemctl stop algod

1. Clone this repository
1. Then:

        cd infrastructure
        make create-private-net

1. Check the access token and network address. You will need them in your config file to correctly connect to a node. When using `make create-private-net` the script will set the network configuration (PrimaryNode/config.json) and token for you to match the `algob.config` used in all our examples. Don't expose the node externally - otherwise you will need to setup a firewall and generate a new token. You can see the network and a port by opening the following files:

        cat node_data/PrimaryNode/algod.net
        cat node_data/PrimaryNode/algod.token

1. To start and stop the the chain use the following commands:

        make start-private-net
        make stop-private-net

1. To set up master account (the account with hardcoded key we use in all our examples):

        make setup-master-account


The command below will combine all the steps above (create network, start network, setup master account and show network status):

    make setup-private-net


To recreate the private net (stop the current instance, remove all data and re-setup):

    make recreate-private-net

### Quick start (using Sandbox)

This is a guide to quickly start a local node using docker and make scripts.

Algorand sandbox is a popular tool among developers to quickly setup up an algorand environment (`algod`, `indexer`, `indexer-db`) using docker. Here user don't need to explicitly setup an algorand node.
Note: make sure to have [Docker](https://docs.docker.com/compose/install/) installed (with non root privilages). Steps:
+ `cd /infrastructure`
+ `make sandbox-up`
+ `make sandbox-setup-master-account`

Read more about sandbox in [Using Sandbox 2.0](https://github.com/scale-it/algo-builder/blob/master/infrastructure/README.md#using-sandbox-20) section.

### Custom setup

If you want to create a local network without using our scripts then you can follow this [tutorial](https://developer.algorand.org/tutorials/create-private-network/**.

### Using Sandbox 2.0

Algorand Sandbox is a fast way to create and configure an Algorand development environment with [Algod](https://github.com/algorand/go-algorand) and [Indexer](https://github.com/algorand/indexer). To quickly bring up a private network with algorand sandbox and use it within algob, following jobs are provided (in `/infrastructure`) :-
*NOTE:* Please make sure to have [Docker Compose](https://docs.docker.com/compose/install/) installed (with non root privilages) before running sandbox.
1. `sandbox-up` - Clones the sandbox [git repo](https://github.com/algorand/sandbox.git) in `~/.algorand-sandbox` and setups the network (this might take a while).

2. `sandbox-setup-master-account` - After starting the network using `sandbox-up`, we can use this job to create the master account present in algob config.

3. `sandbox-algod` - Use this command to enter the algod's docker container. To exit use `ctrl + D`.

4. `sandbox-down` - Bring down the sandbox network i.e stop docker containers running algod, indexer and indexer-db.

5. `sandbox-clean` - Clean up the env by removing stopped container and unused images.

**To be noted :**
- To use goal commands within sandbox environment, we need to use the sandbox executable file (present in ~/.algorand-sandbox). eg. To list accounts using goal, use `~/.algorand-sandbox/sandbox goal account list` (where `~/.algorand-sandbox` is the directory and `~/.algorand-sandbox/sandbox` is the executable file). If you want to use `goal` directly, you can execute these commands from within the algod's container. To enter use `sandbox-algod`.

To learn more about sandbox, click [here](https://github.com/algorand/sandbox#algorand-sandbox).


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


## Reach

[Reach](https://reach.sh/us/) is a domain-specific language for building decentralized applications (DApps). To quickly set up/use reach within algob, we provide the following make jobs:
**NOTE:** Before execution, make sure you have docker and [Docker Compose](https://docs.docker.com/compose/install/) installed.

1. `setup-reach`: sets up reach executable file in `~/.algorand-reach` directory, pulls/update reach docker images from [https://hub.docker.com/u/reachsh](https://hub.docker.com/u/reachsh).

2. `remove-reach`: halts any dockerized devnets, kills & removes docker instances and containers, remove reach bash file from `/home/user/algorand-reach`.

After setup, if you want to use reach commands directly you can use `~/algorand-reach/reach <command>`. For eg, after `setup-reach`, try running `~/algorand-reach/reach --help` to see a list of available commands.

## Indexer v2

The [Indexer](https://developer.algorand.org/articles/introducing-algorands-v2-indexer/) is a standalone service that reads committed blocks from the Algorand blockchain and maintains a database of transactions and accounts that are searchable and indexed.

By default the indexer runs on port `8980` and `postgresdb` on port `5432` (on local or either in a docker container).

### Installation with docker
**Prerequisite:** Make sure to have [Docker Compose](https://docs.docker.com/compose/install/) installed (with non root privilages).

Following make jobs are provided:
1. `indexer-docker-up`: Clones the indexer repo to `~/.algorand-indexer` and runs `docker-compose up` on the [docker-compose.yml](https://github.com/algorand/indexer/blob/develop/docker-compose.yml) file. Starts two services: [`indexer`](https://github.com/algorand/indexer/blob/develop/docker-compose.yml#L4)(on port `8980`) & [`indexer-db`](https://github.com/algorand/indexer/blob/develop/docker-compose.yml#L17)(on port `5432`).
2. `indexer-docker-down`: Stops and removes indexer related container and images.

**NOTE:** Docker based setup runs indexer in a "[read-only](https://github.com/algorand/indexer/blob/develop/docker/run.sh#L10)" mode, without connecting to the private-net `algod` node. Read more about this mode [here](https://github.com/algorand/indexer#read-only).

### Installation on local

The Indexer primarily provides two services: loading a PostgreSQL database with ledger data and supplying a REST API to search this ledger data. For this purpose, setting up indexer on local consists of two steps:
1.  `make setup-postgresql`: Setting up [`postgresql`](https://www.postgresql.org/) database on your local machine.
2. `make recreate-indexer`: Start indexer by connecting to local-db and your private-net algod node. NOTE: it resets (drop & create again) the database before starting.

#### Step1: Setup postgres-db

For this we provide `make setup-postgresql` command. Running it will [install](https://www.postgresql.org/download/linux/ubuntu/) postgresql database on your system and setup a new user & database. Config vars are provided below:
```
host=localhost
port=5432
username=algorand
dbname=pgdb
password=indexer
```

Please note that this installation is currently compatible with Linux based distributions only. For other OS, check [postresql documentation](https://www.postgresql.org/download/).

#### Step2: Start Indexer

**Note:** Make sure you have setup a private network up and running (using `make setup-private-net` or Sandbox). For more instructions check [setting up a local node](./#setting-up-a-local-node) section.

After setting up the database, you can use `make recreate-indexer` to add local indexer binary (downloaded in `~/.algorand-indexer-download`) and start the indexer by connecting to database and your local algod node. Note that the initial loading of the Indexer Database could take some time.

After setting up indexer, open a new terminal and try typing:
```bash
curl "localhost:8980/v2/accounts" | json_pp
```
It should list all accounts in your local-network. More examples can be found [here](https://developer.algorand.org/docs/features/indexer/?query=indexer%2520#date-time).

To **remove** local indexer directory from system, use `make remove-indexer` (removes ~/.algorand-indexer-download).
