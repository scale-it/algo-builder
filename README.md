<img src="/docs/media/logo-website.png" height="200" title="Algo Builder" />

The Algo Builder project is composed from the following packages:

- `algob`: framework to automate development of Algorand Assets and Smart Contracts.
- `types/algosdk`: TypeScript typings for algosdk-js.
- `runtime`: light Algorand runtime and TEAL interpreter.

## Objectives

Algo Builder is an trustworthy framework for Algorand dapps (Decentralized Applications). Its main goal is to make shipping Algorand applications simple, efficient, and salable. Think about it as a Truffle suite for Algorand. The framework provides following functionality through the `algob` tool:

- REPL (console Read-Eval-Print-Loop) to quickly and easily interact with Algorand Standard Assets and Smart Contracts
- integrated testing framework,
- helpful boilerplates allowing developers to focus on use-cases rather than code organization, examples
- Algorand private net
- templates/examples and guides to easily onboard developers

To attract more web developers we plan to build a JavaScript DSL for TEAL with TypeScript bindings (for TEAL inputs). Furthermore we would like to collaborate with SDKs teams to improve the overall development experience and make it ready for enterprise projects. Finally we want to collaborate with Algorand Wallet team to ensure a smooth wallet integration.

## Documentation

- [Home Page](https://algobuilder.dev/)
- [User Docs](https://algobuilder.dev/guide/README)
- [GitHub](https://github.com/scale-it/algo-builder)

### Templates

- [Smart Contracts](https://github.com/scale-it/algo-builder/tree/master/examples)
- [dapps](https://github.com/scale-it/algo-builder-templates) (webapps integrated with smart contracts)

## Requirements

- Node 14+
- Connection to an Algorand node. Follow our [infrastructure guide](https://github.com/scale-it/algo-builder/tree/master/infrastructure/README.md) for instructions how to setup a private network (using Algorand node binaries or docker based setup).
  NOTE: TEAL compilation requires Developer API to be enabled (`"EnableDeveloperAPI": true` in the node config.json).
- Python 3.7+ (for PyTeal) with [pyteal](https://pypi.org/project/pyteal). Please read below how to install it. We recommend to use `pipenv` with our `Pipfile` to stay always up to date.
- Yarn `v3.1+` or NPM `v8.0+` or PNPM `v6.21+` (note: all our examples use yarn v3 workspaces).

### Algorand Node requirements

If you want to use private network then you need to install go-algorand (algod v3.2.0 or higher) or the Algorand Sandbox.

Make sure that the node you are connecting to has a `"EnableDeveloperAPI": true` option set in the `<node_data>/config.json`. This is required to compile smart contracts using REST / SDK.

Follow our [infrastructure guide](https://github.com/scale-it/algo-builder/tree/master/infrastructure/README.md) for more details.

### Connecting to an external Algorand Node

Instead of using a local node, you can connect to an external one by setting the network configuration in the [`algob.config.js`](guide/algob-config) file. More about the project setup and config file is described in the Quick Start section below.

### PyTeal

`algob` supports smart contracts written in PyTeal. To use them, you have to have [pyteal](https://pypi.org/project/pyteal/) package available in your Python context.

#### Using Pipenv

We recommend to use [pipenv](https://pipenv.pypa.io) and use virtual environments. Pipenv is a packaging tool for Python that solves some common problems associated with the typical workflow using pip, virtualenv, and the good old requirements.txt. In addition to addressing some common issues, it consolidates and simplifies the development process to a single command line tool. It automatically creates and manages a virtualenv for your projects, as well as adds/removes packages from your Pipfile as you install/uninstall packages.

With `pipenv` installed you can use the `Pipfile` and `Pipfile.lock` files from this repository and copy it to your project. Then:

    pipenv sync
    pipenv shell

The `pipenv shell` will spawn a shell within the virtualenv with all required packages available in Python3 context. You will need to run `algob` within that python virtualenv context.

#### Using pip3

Otherwise you can use a system/user-wide `pyteal` installation:

    pip3 install pyteal

# Usage

## Quick start

### Create a blockchain

- Use [Private Net Quick Start](/infrastructure/README.md).
- Or install a node with any other network.
- Remember to set `"EnableDeveloperAPI": true` in the node config.json

### Create an algob project 

#### Recommended way

1.  Create a new yarn/npm project:

        mkdir my_new_project
        cd my_new_project
        yarn init

1.  Install algob in the project (unless you already installed it globally) and initialize the workspace.

        yarn add @algo-builder/algob
        yarn run algob init .

    The `init` command expects a directory where to initialize the workspace and creates sample project files there. Refer to [/docs/guide/README](docs/guide#project-initialization) for more information.

1.  Verify if it was installed correctly:

        yarn run algob help

1.  Update the `algob.config.js` file. Make sure you have access to a running Algorand node (which is a part of any network). Check Algorand instructions how to install and run it.

    - set correct host address, port and token (if you are using the private-net, then check algod.net and algob.token files in `node_data/PrimaryNode/`)
    - Note: If you are using `private-net` from `infrastructure`, you don't need to update the network config because they are already configured.
    - you can define multiple networks.
    - update the account list (sample project uses a sample account which doesn't have any ALGO, for transaction executions you need to have an active account with ALGOs). See the comments in `algob.config.js` for more information.
    - Note: If you follow `infrastructure` instructions, you don't need to do this step as well because command will fund the master account.

1. You don't need to install and run Algorand Node yourself. You can connect to any network provider (eg Pure Stake).
1. Add assets and smart-contracts in the `assets` directory.
1. Add deployment scripts in `scripts` directory.
1. Run `yarn run algob deploy` to compile and deploy everything (all scripts nested directly in /scripts).
1. Run `yarn run algob run scriptPath/scriptName` to run a script.
1. To run `algob` on different network (by default the `default` network is used) use

        yarn run algob --network <other_network_name>  <command>


#### Creating a new project using `npx`

``` shell
npx @algo-builder/algob init my-algob-project
```

This command will create a `my-algob-project` directory with sample project files.

Follow the previous section starting from point (3).

#### Adding algob to an existing project

We don't recommend using a global installation (eg `npm install -g ...`).
Simply add `algob` as a dependency to your Node project:

- Using Yarn: `yarn add @algo-builder/algob`
- Using NPM: `npm install @algo-builder/algob`

Then you can add `"algob": "algob"` into the package.json scripts section and use it with `yarn run algob`.

Finally you need to create [`algob.config.js`](docs/algob-config) file.

### Installation from master

We recommend cloning our GitHub _master_ branch if you want to play with [templates](https://github.com/scale-it/algo-builder-templates) and [examples](https://github.com/scale-it/algo-builder/tree/master/examples) (all our example smart contracts are tested against _master_). The master branch corresponds to the latest released version. All examples are linked to the 

```
git clone https://github.com/scale-it/algo-builder.git
cd algo-builder
yarn install
yarn build
```

##### Upgrading

If you use installation from master, don't forget to **pull the latest changes** to not to miss the updates:

```
cd path/to/algo-builder/repository
git pull -p
yarn install
yarn build
```

### Help

Help prints information about top-level tasks:

```bash
algob help
```

Help with additional arguments prints information about a specific task:

```bash
algob help deploy
```

or

```bash
algob -h deploy
```


### Using algob with a TypeScript project

You can write your scripts and tests in TS. To initialize a new typescript project add `--typescript` to the init flag. Example, if you follow the [Create an algob project](#create-an-algob-project) section then:

``` shell
yarn run algob init --typescript 
```

You can also copy our [htlc-pyteal-ts](https://github.com/scale-it/algo-builder/tree/master/examples/htlc-pyteal-ts) example project.


Typescript projects require a transpilation to JavaScript. Then algob can execute `js` files.
To develop in `typescript`, please remember these points:

- Make sure to compile your `ts` project using `yarn build` (which runs `tsc --build .`) Never forget to compile files.
- TIP: If you are actively developing, please use `yarn build:watch`(`tsc -w -p .`) to build or compile your `.ts` files in real time (this is recommended).
- Transpiled js files should be present in `build` folder, therefore `outDir` in tsconfig.json should be set as:

        "outDir": "./build/scripts"


## Examples

Our `/examples` directory provides few projects with smart contracts and ASA. Check the [list](./examples/README.md).

- Please start with reading Algorand reference documentation about [smart contract](https://developer.algorand.org/docs/reference/teal/specification/).
- Don't forget to study Algorand smart contract [guidelines](https://developer.algorand.org/docs/reference/teal/guidelines/).
- Go to the [examples/ref-templates](./examples/ref-templates/README.md) to see how the reference templates are implemented.
- Then go to [examples/asa](./examples/ref-templates/README.md) to learn how you can easily manage and deploy ASA with `algob`.
- Check other examples as well.

## dApp Templates

In the `Algo Builder dApp Templates` [repository](https://github.com/scale-it/algo-builder-templates), several templates can be found to use as a base for implementing dApps.

Using the `algob unbox-template` command, the developers can get a pre-built dApp project containing scripts to deploy assets and smart contracts with react.js interactive frontend. The templates use [AlgoSigner](https://github.com/PureStake/algosigner) to securely sign and send transactions to an Algorand Blockchain Network.

Detailed description about the templates can be found [here](https://github.com/scale-it/algo-builder-templates#algo-builder-templates).

## Project Overview

After initializing a project you will have the following items:

- `assets/`: Directory for assets and contracts files
- `scripts/`: Directory for scripts to deploy and run your assets and contracts
- `tests/`: Directory for test files for testing your assets and contracts
- `algob.config.js`: Algob configuration file

A `sample-project` is provided for your reference.

Further information about the `sample-project` can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/sample-project/README.md)

**NOTE**:
a) You can put smart contracts directly in `/assets` directory as well as in `/assets` subdirectory. For example, you can store your PyTEAL files in `assets/pyteal/<file.py>`.
b) By default `algobpy` package (a helper package to pass compilation parameters to PyTEAL programs) is stored in `/assets/algobpy` folder. `algob` is looking for all `.py` and `.teal` files when loading smart contracts, except files stored in `/assets/algobpy`. You can use the `/assets/algobpy` directory to store custom Python modules and conflicts when loading TEAL smart contracts. Read more about usage of `algobpy` [here](https://github.com/scale-it/algo-builder/blob/master/docs/guide/py-teal.md#external-parameters-support).

### Checkpoints

`algob` uses local file system files to version its state.
These files are called checkpoints and they save information about deployed assets/contracts.
As they are checked-in into Version Control System you can use them to track the deployed state of your assets.

Read more about [checkpoints](https://algobuilder.dev/guide/execution-checkpoints).

# Contributing

Please visit our [contributing page](https://algobuilder.dev/guide/README#contributing) for more information about policies, working with mono repo, testing the project etc...
