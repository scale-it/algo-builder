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

### Currently the example needs to be linked with algob:
```
git clone https://github.com/scale-it/algorand-builder/
cd algorand-builder/packages/algob
yarn
yarn build
yarn link
cd ../../examples/deployment/
yarn link algob
algob help
```

### Change your keys
Use your editor to edit `algob.config.js`

### Run
```
algob deploy
algob run scripts/query/john-balances.js
```

### Repository of this example (may be updated less often):
https://github.com/Invertisment/algob-asa-deploy-opt-in
