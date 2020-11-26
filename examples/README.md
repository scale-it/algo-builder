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

The examples are already initialized. So we don't need to run `yarn run algob init .`

#### PyTEAL

Many examples are using PyTEAL. Please follow our [PyTEAL setup](../README.md#pyteal).

### Update config

We created one config file for all examples in this repository. To use customize it:
copy the `/examples/algob.confg-template.js` to `/examples/algob.config-local.js` and update
the following positions in the latter file:

+ `master-account`: must be an account with some ALGOs - it will be used for deployment and for activating / funding other accounts.
