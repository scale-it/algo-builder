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
    let response = await web.executeTx(txParams);

This code will make the transaction, let the user sign it using algosigner and send it to the network.

You can also use `web.sendTransaction()` or `web.signTransaction()` in a react app.

**NOTE**:

1. We don't support checkpoints yet. Currently `deployASA`, `deploySSC` functions don't work. User should directly pass assetIndex, appIndex instead of asaName, appName.

2. To enable debug dynamically call the `enable()` method :
   `enable(namespaces)`
   `namespaces` can include modes separated by a colon and wildcards.

   To disable all namespaces use `disable()`method.
   The functions returns the namespaces currently enabled (and skipped). This can be useful if you want to disable debugging temporarily without knowing what was enabled to begin with.

```ts
import debug from "./logger";
debug.enable("test");
console.log(1, debug.enabled("test"));

debug.disable();
console.log(2, debug.enabled("test"));
```

print:

```
1 true
2 false
```

By default debug will log to stderr, however this can be configured per-namespace by overriding the log method:

```ts
import debug from "./logger";
const error = debug("app:error");
// by default stderr is used
error("goes to stderr!");
const log = debug("app:log");
// set this namespace to log via console.log
log.log = console.log.bind(console); // don't forget to bind to console!
log("goes to stdout");
error("still goes to stderr!");
// set all output to go via console.info
// overrides all per-namespace log settings
debug.log = console.info.bind(console);
error("now goes to stdout via console.info");
log("still goes to stdout, but via console.info now");
```
