---
layout: splash
---

# User scripts and their execution

## Scripts

In algob, scripts are JS files stored in the `scripts` directory and are meant to interact with the blockchain (deploy ASA, ASC1, run transactions...).

Scripts are run through  `algob run` and `algob deploy` commands. `algob` is using `algob.config.js` to get information about network and accounts and is executing incremental scripts found in `scripts/`.


Please see the [architecture document](https://paper.dropbox.com/published/Algorand-builder-specs--A7njBF~7_VHYy0l3m3RAKgYVBg-c4ycJtlcmEaRIbptAPqNYS6#:h2=Scripts) to see how the scripts are organized and how to use them.


### Script execution

As noted above there are two commands to execute scripts:
- `algob run`
- `algob deploy`


#### Run
Runs provided scripts and doesn't save script checkpoints.
Useful to query the current state of blockchain.
Example:

    algob run scripts/script1.js
#### Deploy
Runs scripts and creates execution [checkpoints](/docs/execution-checkpoints.md).
If a script throws an exception it will stop the execution and script checkpoint won't be created/updated.
During next execution previous scripts will be skipped (results will be cached) and the task will start from the failed script.

Script execution checkpoints are cached in `artifacts` directory.
They guard against duplicate deployment and should be added to version control system.

Execution checkpoints can be overridden by using `--force` to rerun the scripts even if they succeeded previously.
Example:

    algob deploy // will run all the scripts present in scripts folder
    algob deploy scripts/script1.js // will run script1.js.
    algob deploy scripts/script2.js scripts/script1.js // will run script2.js and script1.js in given order


## Tests

In algob, test files are JS files located in `test` directory and their purpose is to test algorand smart contracts present in `/assets`. Check `@algo-builder/runtime` package for more info on tests.

Tests are run through the command `algob test`.
