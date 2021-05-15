---
layout: splash
---

# Algo Builder docs

+ [API documentation](../api/algob/index.html)

+ [Setup](#Setup)
+ Project initialization → read below
+ [Quick Start](https://github.com/scale-it/algo-builder#quick-start)
+ [Configuration](./algob-config.md)
+ [Private Net](/infrastructure/README.md) creation
+ [Script execution](./user-script-execution.md)
+ [Deployer](./deployer.md)
+ [Script Checkpoints](./execution-checkpoints.md)
+ [Script Logging](./logs.md).
+ [Algob Console](./algob-console.md)
+ [PyTeal](./py-teal.md)
+ [Test TEAL](./testing-teal.md)
+ [Best Practices](./best-practices.md)
+ [Templates](./templates.md)

For more in-depth description you can look at the [project specification](https://paper.dropbox.com/published/Algorand-builder-specs--A6Fraxi5VtKhHYbWkTjHfgWyBw-c4ycJtlcmEaRIbptAPqNYS6).


## Setup

### Requirements

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


## Help

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


## Project initialization
To start using `algob` you must first create a project similar to what `yarn` and `npm` would do.
It can be done using this command:
```bash
algob init my-project
```
This will create a directory `my-project` and put multiple files into it.

In the `my-project` folder you'll have following items:
* `assets/`: Directory for assets and contracts files
* `scripts/`: Directory for scripts to deploy and run your assets and contracts
* `tests/`: Directory for test files for testing your assets and contracts
* `algob.config.js`: Algob configuration file

A `sample-project` is provided for your reference.

Further information about the `sample-project` can be found [here](/packages/algob/sample-project/README.md)


### Checkpoints

`algob` uses local file system files to version its state.
These files are called checkpoints and they save information about deployed assets/contracts.
As they are checked-in into Version Control System you can use them to track the deployed state of your assets.

Read more about checkpoints [here](./execution-checkpoints.md).

### Typescript Projects

`Typescript` project requires a transpilation to `js` files. So that algob can execute `js` files.
To develop in `typescript`, please remember these points:

- Make sure to compile your `ts` project using `yarn build` (which runs `tsc --build .`) Never forget to compile files.
- TIP: If you are actively developing, please use `yarn build:watch`(`tsc -w -p .`) to build or compile your `.ts` files in real time (this is recommended).
- Transpiled js files should be present in `build` folder, therefore `outDir` in tsconfig.json should be set as:

    "outDir": "./build/scripts"
- Typescript example [htlc-pyteal-ts](../examples/htlc-pyteal-ts). This example project shows how to build with typescript in algob.
