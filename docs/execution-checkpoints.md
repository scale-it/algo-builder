# Checkpoints

Since blockchain data is immutable (can't be changed) attempts to rewrite its contents are dismissed by the network.
To circumvent this we implemented a file-based checkpoint mechanism to version the contents of the Algorand assets/contracts.

[Scripts](/docs/user-script-execution.md) produce various information about assets/contracts and it has to be preserved.
This deployment information (transaction IDs, asset indexes, etc.) is persisted into checkpoint files for later use (in future scripts).

The checkpoint files are saved in `artifacts/scripts/` in a human-readable YAML format.
Editing is possible but duplicate asset names are not allowed (since it prevents to know which script defined which asset).

Please refer to the [Checkpoints Spec](https://paper.dropbox.com/published/Algorand-builder-specs--A7njBF~7_VHYy0l3m3RAKgYVBg-c4ycJtlcmEaRIbptAPqNYS6#:h2=Deployment-Checkpoints) for more details.

## Usage
To retrieve checkpoint data in a script user can call deployer's functions (script parameter).
Overwriting of checkpoint data from scripts is only allowed when `--force` is used.

Some of its functions provide way to check whether a future checkpoint already deployed an asset with a name: `deployer.isDefined("asset name")`.

Other deployer's methods can provide more information about currently visible assets (scripts are prevented to view checkpoints of other scripts that are going to be run in the future (by name)).
These fields provide a way to view ASA and ASC1 information that was saved in the currently visible checkpoints:
```
deployer.asa
deployer.asc
```
They return JS Maps where asset name (string) points to asset information (see `Checkpoint` type in [types.ts](https://github.com/scale-it/algorand-builder/blob/master/packages/algob/src/types.ts)).
These maps shouldn't be edited by the script itself.
Other deployer functions do that.

Checkpoint supports additional user's metadata persistence by calling `deployer.addCheckpointKV` (adds key and value to the current checkpoint) in _deploy_ mode (`algob deploy`). User can read that metadata in any script (also in _run_ mode or REPL) using `deployer.getCheckpointKV`.

```
deployer.addCheckpointKV(key: string, value: string)
deployer.getCheckpointKV(key: string)
```

All deployment related functions from `deployer` will automatically add transaction related information to metadata.
However, if a deployment script doesn't use `deployer` deployment functions (for example if we have a deployment script which funds basic accounts), then a checkpoint will be empty and won't be stored. So, consecutive run of `algob deploy` will re-execute that script. If we want to **assure  script checkpoints** (and script re-execution) then a user MUST call `deployer.addCheckpointKV` in each script where he doesn't call deployer deployment functions explicitly.

The checkpoint files are only saved after a successful `deploy` task. The data is not saved if an error happens. There is one checkpoint per deployment script.

When reading metadata (`deployer.getCheckpointKV`) we browses all checkpoints from all files.


## YAML file structure
As it's possible to work on multiple networks (`--network` switch) it's possible to have distinct chain states in their respective networks.
Every checkpoint file is defined as a network name pointing into an object of checkpoint object values.

These checkpoint values should contain `timestamp`, `metadata`, `asa` and `asc` (or more).

`metadata`, `asa` and `asc` are maps which point to their own specific objects.
The keys of these maps are strings which should be unique per network inside of all checkpoints.

Editing them by hand is not encouraged (but if it's needed their names must not match any asset in the same network).
Currently it's possible to edit these files by hand but it may be decided to disallow this in the future.

## Parameters

For more details on checkpoint parameters and their specific types please refer to `Checkpoint` type in [types.ts](https://github.com/scale-it/algorand-builder/blob/master/packages/algob/src/types.ts).
Make sure that your local `algob` version matches the version from the link.
