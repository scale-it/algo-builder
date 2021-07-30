# @algo-builder/web

`@algo-builder/web` package allows you to interact with contracts easily. It is designed to be used with web dapps as well as scripts and user programs.

This package provides a class `WebMode` which has variety of high level functions like, [`waitForConfirmation`](algobuilder.dev/api/web/classes/web.html#waitForConfirmation), [`executeTransaction`]((algobuilder.dev/api/web/classes/web.html#executeTransaction)), [`signTransaction`]((algobuilder.dev/api/web/classes/web.html#signTransaction)), etc. These functions help sending transactions and building dapps.

### Relation to algob

`algob` uses `@algo-builder/web` package. However It is not possible to use `algob` directly in a web app, because `algob` uses nodejs file system. Therefore we created a lightweight `@algo-builder/web` package to provide common functionality and support dapp development.

In the `@algo-builder/web` package we pass transaction [parameters](https://github.com/scale-it/algo-builder/blob/master/docs/guide/execute-transaction.md) in the same way as we do in `algob`.

## Important links

+ [Home Page](https://scale-it.github.io/algo-builder)
+ [Web API Docs](https://scale-it.github.io/algo-builder/api/web/index.html)
+ [User Docs](https://scale-it.github.io/algo-builder/guide/README)

## Using Web

`@algo-builder/web` can be included as a library using `yarn add @algo-builder/web` and then import it using `import * from '@algo-builder/web'`.

### Example

To use `web` package in your react app, first you need to create an instance of the `WebMode` class by passing `AlgoSigner` and the chain name.

    const web = new WebMode(AlgoSigner, CHAIN_NAME);

Now you can use it to execute a transaction:

    const txParams = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccountAddr: fromAddress,
      toAccountAddr: toAddress,
      amountMicroAlgos: amount,
      payFlags: {},
    };
    let response = await web.executeTransaction(txParams);

This code will make the transaction, let the user sign it using algosigner and send it to the network.

You can also use `web.sendTransaction()` or `web.signTransaction()` in a react app.

**Note:** We don't support checkpoints yet. Currently `deployASA`, `deploySSC` functions don't work. User should directly pass assetIndex, appIndex instead of asaName, appName.
