# ASA deployment using [Algorand Builder](https://github.com/scale-it/algorand-builder/)

Creates two Algorand Standard Asset (ASA) tokens: gold and tesla.
Specifications for these tokens can be found in `assets/asa.yaml`.

Each of those tokens are owned by their specific owner accounts.
After the creation a third account is opted-in in order to receive the tokens.

Transfers can be executed by executing `algob run scripts/transfer/gold-to-john.js` and other scripts in `scripts/transfer/`.
These scripts contain logic to transfer assets to `john-account` but other accounts can be configured as well.

Balances can be queried by executing `algob run scripts/query/john-balances.js`.

## Usage
### Create your local network:
https://developer.algorand.org/tutorials/create-private-network/

### Start whole network:
```
goal network start -r ~/.algorand-local/
```

### Start/stop a single node:
```
goal node start -d ~/.algorand-local/Node/
```

### Add algob and start using it

We need to add algob as the package dependency.

    yarn add algob

After that, `algob` will be added to a local yarn context. To use it we either access `algob` through `node_modules/.bin`, or through `yarn run`. We advice to use the latter one.

The example is already initialized. So we don't need to run `yarn run algob init .`

### Update config

Open `algob.config.js` and update:

+ Update `master-account`. It must be an account with some ALGOs - it will be used for deployment and for activating / funding other accounts.

### Run
```
algob deploy
algob run scripts/query/john-balances.js
```

### Repository of this example (may be updated less often):
https://github.com/Invertisment/algob-asa-deploy-opt-in
