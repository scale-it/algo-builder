# User scripts and their execution

## Scripts

In algob, scripts are JS files stored in the `scripts` directory.
They are used to manage migrations and deployments.
Child directories are also possible.

Please see the [architecture document](https://paper.dropbox.com/doc/Algorand-builder-architecture--A3aVSVEt3HIRGIiCnTMbn64DAg-Vcdp0XNngizChyUWvFXfs#:uid=213683005476107006060621) to see how the scripts are organized and how to use them.

### Script execution

Scripts can be executed in two ways:
- `algob run`
- `algob deploy`

#### Run
Runs provided scripts by not saving any script state snapshots. Useful to query the current state of blockchain.

#### Deploy
Runs scripts and stops if any of them fails.
Any script that throws an exception will stop the execution and script state won't be saved.
During next execution previous scripts will be skipped (results will be cached) and the task will start with the failed script.

Script execution checkpoints are cached in `artifacts` directory. 
They guard against duplicate deployment and should be added to version control system.

Execution checkpoints can be overridden by using `--force` to rerun the scripts even if they succeeded previously.
