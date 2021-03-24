---
layout: splash
---

# Algo Builder docs

+ [API documentation](https://scale-it.github.io/algo-builder/)

+ Installation: [main README](/README.md#installation) file.
+ Project initialization → read below.
+ [Configuration](./algob-config.md).
+ [Private Net](/infrastructure/README.md) creation.
+ [Script execution](./user-script-execution.md).
+ [Deployer](./deployer.md)
+ [Script Checkpoints](./execution-checkpoints.md).
+ [Script Logging](./logs.md).
+ [Algob Console](./algob-console.md)
+ [PyTeal](./py-teal.md).
+ [Test TEAL](./testing-teal.md).
+ [Best Practices](./best-practices.md)

For more in-depth description you can look at the [project specification](https://paper.dropbox.com/published/Algorand-builder-specs--A6Fraxi5VtKhHYbWkTjHfgWyBw-c4ycJtlcmEaRIbptAPqNYS6).


## Help

Help prints information about top-level tasks:
```
algob help
```
Help with additional arguments prints information about a specific task:
```
algob help deploy
```
or
```
algob -h deploy
```


## Project initialization
To start using `algob` you must first create a project similar to what `yarn` and `npm` would do.
It can be done using this command:
```
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
