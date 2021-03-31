# Algo Builder

Framework to automate development of Algorand Assets and Smart Contracts:

+ `algob`: tool
+ `types/algosdk`: TypeScript typings for algosdk-js
+ `runtime`: light algorand runtime and TEAL interpreter

## Objectives

Algo Builder is an trustworthy framework for Algorand dapps (Decentralized Applications). Its main goal is to make shipping Algorand applications simple, efficient, and scalable. Think about it as a Truffle suite for Algorand. The framework provides following functionality through the `algob` tool:

+ REPL (console Read-Eval-Print-Loop) to quickly and easily interact with Algorand Standard Assets and Smart Contracts
+ integrated testing framework,
+ helpful boilerplates allowing developers to focus on use-cases rather than code organization, examples
+ algorand private net
+ tutorials to easy onramp process.

To attract more web developers we plan to build a JavaScript DSL for TEAL with TypeScript bindings (for TEAL inputs). Furthermore we would like to collaborate with SDKs teams to improve the overall development experience and make it ready for enterprise projects. Finally we want to collaborate with Algorand Wallet team to ensure a smooth wallet integration.


### Documentation

User documentation is available in [/user-docs](user-docs/README.md) and [API docs](https://scale-it.github.io/algo-builder/).

The project specification is [published here](https://paper.dropbox.com/published/Algorand-builder-specs--A6Fraxi5VtKhHYbWkTjHfgWyBw-c4ycJtlcmEaRIbptAPqNYS6).


## Requirements

+ Node 12+
+ Connection to an Algorand node. TEAL compilation requires Developer API to be enabled (`"EnableDeveloperAPI": true` in the node config.json).
+ Python 3.7+ (for PyTeal) with [pyteal](https://pypi.org/project/pyteal). Please read below how to install it.
+ Yarn `v1.22+` or NPM `v6.0+`

### Installation

To install `algob` globally in your system you can use:

+ Using Yarn: `yarn global add @algo-builder/algob`
+ Using NPM: `npm install -g @algo-builder/algob`


**Recommended**: Installation from source (if you want to use `algob` with latest, not released version):

```
git clone https://github.com/scale-it/algo-builder.git
cd algo-builder
yarn install
yarn build
cd packages/algob
yarn link
```
Finally, make sure your `yarn global bin` directory is in your `$PATH`.



### Algorand Node requirements

+ algod v2.1.6-stable or higher

Make sure that the node you are connecting to has a `"EnableDeveloperAPI": true` option set in the `<node_data>/config.json`. This is required to compile smart contracts using REST / SDK.


### PyTeal

`algob` supports TEAL smart contracts written in PyTeal. To use them, you have to have [pyteal](https://pypi.org/project/pyteal/) package available in your Python context:

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

+ Use [Private Net Quick Start](/infrastructure/README.md).
+ Or install a node with any other network.
+ Remember to set `"EnableDeveloperAPI": true` in the node config.json

### Create an algob project

1. Create a new yarn/npm project:

        mkdir my_new_project
        cd my_new_project
        yarn init

1. Install algob in the project (unless you already installed it globally) and initialize the workspace.

        yarn add @algo-builder/algob
        yarn run algob init .

    The `init` command expects a directory where to initialize the workspace and creates sample project files there. Refer to [/docs/README](docs/README.md) for more information.

1. Verify if it was installed correctly:

        yarn run algob help

1. Update the `algob.config.js` file. Make sure you have access to a running Algorand node (`algod`). Check Algorand instructions how to install and run it.
    * set correct host address, port and token (if you are using the private-net, then check algod.net and algob.token files in `node_data/PrimaryNode/`)
    * Note: If you are using `private-net` from `infrastructure`, you don't need to update the network config because they are already configured.
    * you can define multiple networks.
    * update the account list (sample project uses a sample account which doesn't have any ALGO, for transaction executions you need to have an active account with ALGOs). See the comments in `algob.config.js` for more information.
    * Note: If you follow `infrastructure` instructions, you don't need to do this step as well because command will fund the master account.

1. Add assets and smart-contracts in the `assets` directory.
1. Add deployment scripts in `scripts` directory.
1. Run `yarn run algob deploy` to compile and deploy everything.
1. Run `yarn run algob run scriptPath/scriptName` to run script.
1. To run `algob` on different network (by default the `default` network is used) use

        yarn run algob --network <other_network_name>  <command>


### Examples

Our `/examples` directory provides few projects with smart contracts and ASA. Check the [list](./examples/README.md).

+ Please start with reading Algorand reference documentation about [smart contract](https://developer.algorand.org/docs/reference/teal/specification/).
+ Don't forget to study Algorand smart contract [guidelines](https://developer.algorand.org/docs/reference/teal/guidelines/).
+ Go to the [examples/ref-templates](./examples/ref-templates/README.md) to see how the reference templates are implemented.
+ Then go to [examples/asa](./examples/ref-templates/README.md) to learn how you can easily manage and deploy ASA with `algob`.
+ Check other examples as well.


## Using algob with a TypeScript project

You can use `algob` within a TS project. You can write your scripts and tests in TS. However to use them with `algob` you firstly need to compile the project to JS.

TIP: Use `tsc --watch` to update the build in a realtime while you develop the project

TODO: we are planning to provide a template for TS projects. [task](https://www.pivotaltracker.com/n/projects/2452320).

## Templates

In the `Algo-Builder-Templates` [repository](https://github.com/scale-it/algo-builder-templates), several templates can be found to use as a base for implementing dApps.

Using the `algob unbox-template` command, the developers can get a pre-built dApp project containing scripts to deploy assets and smart contracts with react.js interactive frontend. The templates use [AlgoSigner](https://github.com/PureStake/algosigner) to securely sign and send transactions to an Algorand Blockchain Network. 

Detailed description about the templates can be found [here](https://github.com/scale-it/algo-builder-templates#algo-builder-templates).


# Contributing

## Development

The project development is open and you can observer a progress through [Pivotal tracker board](https://www.pivotaltracker.com/n/projects/2452320).

## Working with monorepo

We use **yarn workspaces** to manage all sub packages. here is a list of commands which are helpful in a development workflow

* `yarn workspaces info`
* `yarn workspaces list`
* `yarn workspaces <package-name> <command>`, eg: `yarn workspaces mypkg1 run build` or  `yarn workspaces mypkg1 run add --dev react`
* `yarn add algosdk` -- will add `algosdk` to all sub projects (workspaces)

`yarn` does not add dependencies to node_modules directories in either of your packages  –  only at the root level, i.e., yarn hoists all dependencies to the root level. yarn leverages symlinks to point to the different packages. Thereby, yarn includes the dependencies only once in the project.

You have to utilize yarn workspaces’ `noHoist` feature to use otherwise incompatible 3rd party dependencies working in the Mono-Repo environment.
