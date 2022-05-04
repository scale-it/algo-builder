This is a boilerplate `algob` project with ASA deployment and funding a smart contract (in TEAL & PyTEAL)

To run the `sample-project`:

- First you need to set the configuration in `algob.config.js` file:

  - Specify accounts you want to use, there are multiple ways to do it. You can see [here](/docs/algob-config.md)
  - If you are using Testnet, use https://bank.testnet.algorand.network/ to fund address.
  - If you are using Private Network, use `goal clerk send`
    (https://developer.algorand.org/docs/reference/cli/goal/clerk/send/) to fund address.

  - After this specify your `network configurations`.

- Install `Algo Builder`

  - `yarn add @algo-builder/algob` or
  - `yarn link @algo-builder/algob` (with local installation, this is recommended if you want to use `algob` with latest, not released version). Read more about it [here](https://github.com/scale-it/algo-builder#installation).

- Deploy ASA and Smart Contracts:

  - `algob deploy`

- Scripts ran with deploy command will store checkpoints in artifacts directory. If a script already has a checkpoint it won’t be run again unless `--force | -f` flag is provided to deploy command.

  - `algob deploy -f`

- To interact with your deployments you can create a script and run it using:

* `algob run scripts/path_to/file1`
* Don’t use algob run for deployments. This should be used only for auxiliary scripts, like ad-hock transactions (example: draining an account).

- Run tests:

  - `algob test` (runs mocha in project root)

In the `sample-project` folder you'll have following items:

- `assets/`: Directory for assets and contracts files:

  - `accounts_user.yaml` : It has sample accounts
  - `asa.yaml` : It has sample specifications for Algorand Standard Assets (ASA)
  - `fee-check.teal` : It's a smart contract file. It checks the provided fee is at least 10,000 microalgos
  - `escrow.py`: Smart contract (in PyTEAL), only approves transfer to a specific address (hardcoded in the contract).
  - You can change or add ASA, Smart Contracts in this folder.

- `scripts/`: Directory for scripts to deploy and run your assets and contracts:

  - `0-sampleScript.js` : This script shows how to deploy ASA.
  - `1-sampleScript.js` : This script shows how to deploy ASC.
  - `2-escrow-account.js`: This script funds an escrow contract with a hardcoded template parameter (passed in script)

- `test/`: Directory for test files for testing your assets and smart contracts:

  - `sample-test.js` : This is a basic example of how tests should be and how they work.
  - You can add tests for your scripts here.

- `algob.config.js`: Algob configuration file

Before writing smart contracts in PyTEAL:

- Please follow standard instuctions about [PyTEAL Setup](https://github.com/scale-it/algo-builder/blob/master/README.md#pyteal)
- For passing template parameters dynamically in PyTEAL contract you will need to add [`algobpy`](https://github.com/scale-it/algo-builder/tree/master/examples/algobpy) in your project directory.
  - Read more about usage of `algobpy` and passing template parameters in /scripts [here](https://github.com/scale-it/algo-builder/blob/master/docs/guide/py-teal.md#external-parameters-support)
- PyTEAL supports `Tmpl` fuction which can replace value with a constant and `algob` supports these replacements. To read more about TMPL Placeholder Support click [here](https://github.com/scale-it/algo-builder/blob/master/docs/guide/py-teal.md#tmpl-placeholder-support)
