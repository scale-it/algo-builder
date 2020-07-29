# User scripts and their execution

## Scripts

In algob, scripts are JS files stored in the `scripts` directory.
They are used to manage script executions and deployments.
Child directories are also possible.

Please see the [architecture document](https://paper.dropbox.com/doc/Algorand-builder-architecture--A3aVSVEt3HIRGIiCnTMbn64DAg-Vcdp0XNngizChyUWvFXfs#:uid=213683005476107006060621) to see how the scripts are organized and how to use them.

### Script execution

Scripts can be executed in two ways:
- `algob run`
- `algob deploy`


#### Run
Runs provided scripts and doesn't save script checkpoints.
Useful to query the current state of blockchain.

#### Deploy
Runs scripts and saves script execution checkpoints.
If a script throws an exception it will stop the execution and script checkpoint won't be created/updated.
During next execution previous scripts will be skipped (results will be cached) and the task will start from the failed script.

Script execution checkpoints are cached in `artifacts` directory. 
They guard against duplicate deployment and should be added to version control system.

Execution checkpoints can be overridden by using `--force` to rerun the scripts even if they succeeded previously.
