# [Algo Builder Web](https://algobuilder.dev/)

`@algo-builder/web` package allows you to interact with contracts easily. It is designed to be used with web dapps as well as scripts and user programs.

This package provides a class `WebMode` which has variety of high level functions like, [`waitForConfirmation`](algobuilder.dev/api/web/classes/web.html#waitForConfirmation), [`executeTx`](<(algobuilder.dev/api/web/classes/web.html#executeTx)>), [`signTransaction`](<(algobuilder.dev/api/web/classes/web.html#signTransaction)>), etc. These functions help sending transactions and building dapps.

You can use `@algo-builder/web` with [pipeline UI](https://www.pipeline-ui.com/docs/algocomponents/algobutton) to easily integrate with web wallets.

### Relation to algob

`algob` uses `@algo-builder/web` package. However It is not possible to use `algob` directly in a web app, because `algob` uses nodejs file system. Therefore we created a lightweight `@algo-builder/web` package to provide common functionality and support dapp development.

In the `@algo-builder/web` package we pass transaction [parameters](https://github.com/scale-it/algo-builder/blob/master/docs/guide/execute-transaction.md) in the same way as we do in `algob`.

## Important links

- [Home Page](https://algobuilder.dev/)
- [Web API Docs](https://algobuilder.dev/api/web/index.html)
- [User Docs](https://algobuilder.dev/guide/README)

## Using Web

`@algo-builder/web` can be included as a library using `yarn add @algo-builder/web` and then import it using `import * from '@algo-builder/web'`.

### Example

You can connect to `web` package in your react app by using different wallets.

1.  AlgoSigner:
    Create an instance of the `WebMode` class by passing `AlgoSigner` and the chain name.

        const connector = new WebMode(AlgoSigner, CHAIN_NAME);

2.  MyAlgo Wallet:
    Create an instance of the `MyAlgoWalletSession` class by passing the chain name and connect it using `connectToMyAlgo`.

         const connector = new MyAlgoWalletSession(CHAIN_NAME)
         await connector.connectToMyAlgo();

3.  Wallet Connect:
    Create an instance of the `WallectConnectSession` class by passing the chain name and create a session using `create` and then connect to it using `onConnect`.

    const connector = new WallectConnectSession(CHAIN_NAME);
    await connector.create(true);
    connector.onConnect((error, response) => console.log(error, response));

Now you can use it to execute a transaction:

    const txParams = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccountAddr: fromAddress,
      toAccountAddr: toAddress,
      amountMicroAlgos: amount,
      payFlags: {},
    };
    let response = await connector.executeTx(txParams);

This code will make the transaction, let the user sign it using wallet selected and send it to the network.

You can also use `connector.sendTransaction()` or `connector.signTransaction()` in a react app.

**Note:** We don't support checkpoints yet. Currently `deployASA`, `deploySSC` functions don't work. User should directly pass assetIndex, appIndex instead of asaName, appName.
