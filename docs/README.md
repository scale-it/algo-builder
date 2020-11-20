# Algorand Builder docs

+ Installation: [main README](/README.md) file.
+ Project initialization → read below.
+ [Configuration](/docs/algob-config.md).
+ [Devnet](/infrastructure/README.md) creation.
+ [Script execution](/docs/user-script-execution.md).
+ [Deployer](/docs/deployer.md)
+ [Script Checkpoints](/docs/execution-checkpoints.md).
+ [Script Logging](/docs/logs.md).
+ [Algob Console](/docs/algob-console.md)
+ [PyTeal](/docs/py-teal.md).
+ [API docs](https://scale-it.github.io/algorand-builder/)

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

Read more about checkpoints [here](/docs/execution-checkpoints.md).
