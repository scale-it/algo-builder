# Algorand Builder docs

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


## Configuration

One of the most important files in the project is your configuration file: `algob.config.js`.
It can contain multiple network configurations and configured accounts.

Further information about the configuration can be found [here](/docs/algob-config.md).


## User script execution
Tasks `algob run` and `algob deploy` can run user-defined code to interact with Algorand blockchain node.
They do this by loading connection information from `algob.config.js` and executing incremental scripts found in `scripts/`.

Script execution details can be found [here](/docs/user-script-execution.md).

### Checkpoints
`algob` uses local file system files to version its state.
These files are called checkpoints and they save information about deployed assets/contracts.
As they are checked-in into Version Control System you can use them to track the deployed state of your assets.

Read more about checkpoints [here](/docs/execution-checkpoints.md).
