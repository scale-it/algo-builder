# Deployer

Deployer is a class that helps you deploy [Algorand Standard Assets(ASA)](https://developer.algorand.org/docs/features/asa/) and [Stateful Smart Contracts(SSC)](https://developer.algorand.org/docs/features/asc1/stateful/) to the Algorand network.

You can deploy a ASA from the `sample-project` with the deploy script `scripts/0-sampleScript.js`,

You can write deployment tasks synchronously and they'll be executed in the correct order.

    // ASA-1 will be deployed before ASA-2
    await deployer.deployASA("ASA-1", {...});
    await deployer.deployASA("ASA-2", {...});

To deploy an ASA you must have `asa.yaml` file in `assets` folder.

You can deploy a SSC from the `examples/permissioned-voting` with the deploy script `scripts/voting.js`.

    await deployer.deploySSC("approval.teal", "clear.teal", {...});

smart contracts must be stored in `assets` folder.

The main difference between deploying an ASA and SSC is that ASA takes `asset-name` and `ASADeploymentFlags` as input and SSC takes `smart-contract-names` and `SSCDeploymentFlags` as input.

You can learn more about the flags from [Deployer API](https://scale-it.github.io/algorand-builder/);