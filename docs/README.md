# Algorand Builder docs

+ Installation: [main README](/README.md) file.
+ Project initialization → read below.
+ [PROJECT configuration](/docs/algob-config.md).
+ [Devnet](/infrastructure/README.md) creation.
+ [Script execution](/docs/user-script-execution.md).
+ [Script checkpoints](/docs/execution-checkpoints.md).

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

Read more about checkpoints [here](/docs/execution-checkpoints.md).
