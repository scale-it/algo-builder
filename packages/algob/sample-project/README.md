This is a boilerplate `algob` project with ASA deployment and funding a smart contract

To run the `sample-project`:

* First you need to set the configuration in `algob.config.js` file:

  - Specify accounts you want to use, there are multiple ways to do it. You can see [here](/docs/algob-config.md)
  - If you are using TestNet, use https://bank.testnet.algorand.network/ to fund address.
  - If you are using Private Network, use `goal clerk send`
  (https://developer.algorand.org/docs/reference/cli/goal/clerk/send/) to fund address.

  - After this specify your `network configurations`.

* Install `Algo Builder`

  - `yarn add @algo-builder/algob` or
  - `yarn link @algo-builder/algob` (with local installation, this is recommended if you want to use `algob` with latest, not released version). Read more about it [here](https://github.com/scale-it/algo-builder#installation).

* Deploy your ASA and Smart Contracts:

  - `yarn run algob deploy`

* All scripts run with deploy command will store a checkpoint in the artifacts directory. If a script has already a checkpoint it won’t be run again unless `--force | -f` flag is provided to deploy command.

  - `yarn run algob deploy -f`

* Also to interact with your deployments you can create a script and run it using:

  - `yarn run algob run file1`
  - Don’t use algob run for deployments. This should be used only for auxiliary scripts, like ad-hock transactions (example: draining an account).


* Run tests:

  - `yarn run algob test` (runs mocha in project root)

In the `sample-project` folder you'll have following items:

* `assets/`: Directory for assets and contracts files:
    - `accounts_user.yaml` : It has a sample account
    - `asa.yaml` : It has sample specifications for Algorand Standard Assets (ASA)
    - `fee-check.teal` : It is a smart contract file. It checks the provided fee is at least  10,000 microalgos
    - You can change or add ASA, Smart Contracts in this folder.

* `scripts/`: Directory for scripts to deploy and run your assets and contracts:
    - `0-sampleScript.js` : This script shows how to deploy ASA.
    - `1-sampleScript.js` : This script shows how to deploy ASC.

* `test/`: Directory for test files for testing your assets and smart contracts:
    - You can add tests for your scripts here. Basic tests for algo-transfer using `@algo-builder/runtime` are added.

* `algob.config.js`: Algob configuration file
