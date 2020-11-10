# Common Setup

This file provides common instructions for all examples.

## Setup

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

### Install dependencies

All dependencies are managed by `npm` / `yarn`. To install:

    yarn install

If want to use a development version of `algob`, you can use `yarn link`:

    yarn remove algob
    yarn link algob


After that, `algob` will be in your local yarn context. To use it we either access `algob` through `yarn run` (recommended), or through `node_modules/.bin`.

The example is already initialized. So we don't need to run `yarn run algob init .`


### Update config

Open `algob.config.js` and update:

+ Update `master-account`. It must be an account with some ALGOs - it will be used for deployment and for activating / funding other accounts.
