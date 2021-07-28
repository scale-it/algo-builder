# Web

Web allows you to interact with contracts easily. It is designed to be used with web dapps.

This package provides a class `WebMode` which has variety of high level functions like, `waitForConfirmation`, `executeTransaction`, `signTransaction`, etc. These functions help in sending transactions easier when building dapps using react.

It is not possible to use `algob` directly in a react app, because `algob` uses nodejs file system which cannot be used in a react app. Therefore we created a lightweight packake web which can be used to create and send transactions to the network from react app.

In Web package we pass transaction [parameters](https://github.com/scale-it/algo-builder/blob/master/docs/guide/execute-transaction.md) same as we do in `algob`.

## Important links

+ [Home Page](https://scale-it.github.io/algo-builder)
+ [Web API Docs](https://scale-it.github.io/algo-builder/api/web/index.html)
+ [User Docs](https://scale-it.github.io/algo-builder/guide/README)

## Using Web

`Web` can be included as a library using `yarn add @algo-builder/web` and then import it using `import * from '@algo-builder/web'`.

## Example

To use `web` package in your react app, first you need to create an instance of `WebMode` class by passing `AlgoSigner` and `Chain_name`.

    const web = new WebMode(AlgoSigner, CHAIN_NAME);

Now you can use this instance to perform transaction execution

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

You can also use `web.sendTransaction()` or `web.signTransaction()` from react app.