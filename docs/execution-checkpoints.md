# Checkpoints

Since blockchain data is immutable (can't be changed) attempts to rewrite its contents are dismissed by the network.
To circumvent this we implemented a file-based checkpoint mechanism to version the contents of the Algorand assets/contracts.

[Scripts](/docs/user-script-execution.md) produce various information about assets/contracts and it has to be preserved.
This deployment information (transaction IDs, asset indexes, etc.) is persisted into checkpoint files for later use (in future scripts).

The checkpoint files are saved in `artifacts/scripts/` in a human-readable YAML format.
Editing is possible but duplicate asset names are not allowed (since it prevents to know which script defined which asset).

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

