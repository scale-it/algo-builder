---
layout: splash
---

# Connect algob project settings with a webapp

In this guide we explain how an `algob` project can be easily connetced/integrated with your dapp.

## About @algo-builder/web

We recently released [`@algo-builder/web`](https://github.com/scale-it/algo-builder/tree/master/packages/web) package which allows you to interact with contracts easily. It is designed to be used with web dapps as well as scripts and user programs. For more information check out the [`using-web`](https://github.com/scale-it/algo-builder/tree/master/packages/web#using-web) section.

## About algob

`Algob` is the CLI (Command Line Interface) for Algo Builder. Think about it as an Ethereum Truffle but for Algorand projects. `algob` can be included as a library using `yarn add @algo-builder/algob` and then import it using `import * from '@algo-builder/algob'` or can be run from command line as described in the project [README](https://github.com/scale-it/algo-builder/blob/master/README.md) file.

## Usage in Webapp

Currently, it is not possible to use `algob` **directly in a web app**, because algob uses nodejs file system. Because of this issue, `@algo-builder/web` was designed to provide common functionality and support dapp development.

Project structure:
```
Webapp:
├── assets
│   ├── TEAL files
│   ├── PyTEAL files
├── scripts (algob project scripts)
│   ├── deploy.ts
│   ├── run.ts
├── src (react frontend code)
│   ├── app.js
│   ├── index.js
├── test
│   ├── JS test files
│   ├── .mocharc.json (optional)
├── algob.config.js
├── package.json (common for algob & react-app)
```

Contracts are present in `/assets`, scripts are present in `/scripts` folder, and dapp's frontend code is available in `/src` folder.

## Checkpoints

In an `algob` project we persist [checkpoints](./algob-web-checkpoints.md). This is helpful to store deployment information (transaction IDs, asset indexes, etc.) for later use (in future scripts).
+ The checkpoint files are saved in `artifacts/scripts/` in a human-readable YAML format. Contains:
    + Deployed informaton (assetID, appID, creator, txID, etc.)
    + Logic Signatures (Delegated/signed OR unsigned)
+ Cached information (eg. compiled smart contracts) are stored in `artifacts/cache` (contract filename, compiled hash, TEAL code, etc.)

Since, `@algo-builder/web` API can't load data from files in your webapp, user either needs to:
+ copy these checkpoints from `/artifacts` to your webapp (inside `/src/`), so it can be bundled by webpack and deployed.
+ OR, you can override your react-app config and remove `removeModuleScopePlugin` (this allows imports outside `/src` folder in react-app)

After you're able to import checkpoint files (in `/artifacts/*.yaml`), you can simply add a yaml loader to load files & read data in your react source code. For eg. (reading a logic sig from checkpoints data and getting the contract's address). As a reference, checkout [config-overrides.js](https://github.com/scale-it/algo-builder-templates/blob/master/htlc/config-overrides.js) file.

## Reference

For reference checkout [`algo-builder-templates/htlc`](https://github.com/scale-it/algo-builder-templates/tree/master/htlc) project. It's a webapp with integrated with an algob project. You firstly deploy the smart contracts using `algob deploy`. The deployed information in checkpoints is used by the dapp's frontend (for eg. ASA ID).

We have also added a [config-overrides.js](https://github.com/scale-it/algo-builder-templates/blob/master/htlc/config-overrides.js) to override `webpack.config.js`:
+ add a yaml loader
+ allow imports from outside `/src` in react app (so these could be bundled in webpack config)
