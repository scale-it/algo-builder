# ASA deployment using [Algorand Builder](https://github.com/scale-it/algorand-builder/)

## Usage
### Create your local network:
https://developer.algorand.org/tutorials/create-private-network/

### Start whole network:
`goal network start -r ~/.algorand-local/`

### Start/stop a single node:
`goal node start -d ~/.algorand-local/Node/`

### Currently it needs to be linked with algob:
`git clone https://github.com/scale-it/algorand-builder/`
`cd algorand-builder/packages/algob`
`yarn`
`yarn link`

### Change your keys
Use your editor to edit `algob.config.js`

### Run
`algob deploy`
`algob run scripts/query/john-balances.js`

### Repository of this example (may be updated less often):
https://github.com/Invertisment/algob-asa-deploy-opt-in
