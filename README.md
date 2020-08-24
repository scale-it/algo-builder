# algorand-builder
Framework to automate development of Algorand Assets and Smart Contracts.

## Objectives

Algorand builder is an trustworthy framework for Algorand dapps (Decentralized Applications). Main goal is to make shipping Algorand applications simple, efficient, and scalable. Think about it as a truffle suite for Algorand. The framework provides following functionality:

+ REPL (console Read-Eval-Print-Loop) to quickly and easily interact with Algorand Standard Assets and Smart Contracts
+ integrated testing framework,
+ helpful boilerplates allowing developers to focus on use-cases rather than code organization, examples
+ algorand devnet
+ tutorials to easy onramp process.

To attract more web developers we plan to build a JavaScript DSL for TEAL with TypeScript bindings (for TEAL inputs). Furthermore we would like to collaborate with SDKs teams to improve the overall development experience and make it ready for enterprise projects. Finally we want to collaborate with Algorand Wallet team to ensure a smooth wallet integration.


### Specification

The project specification is [published here](https://paper.dropbox.com/published/Algorand-builder-specs--A6Fraxi5VtKhHYbWkTjHfgWyBw-c4ycJtlcmEaRIbptAPqNYS6).

## Requirements

+ Node 12+
+ Connection to an Algorand node.


## Algorand Node requirements

+ algod v2.1.3+

Make sure that the node you are connecting to has a `"EnableDeveloperAPI": true` option set in the `<node_data>/config.json`. This is required to compile smart contracts using REST / SDK.

# Usage

See [user script documentation](docs/user-script-execution.md) for info about custom scripts and deployments.

## Using algob with a TypeScript project

You can use `algob` within a TS project. You can write your scripts and tests in TS. However to use them with `algob` you firstly need to compile the project to JS.

TODO: provide a project template for TS projects. [task](https://www.pivotaltracker.com/n/projects/2452320).

TIPS:

+ Use `tsc --watch` to update the build in a realtime while you develop the project

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
