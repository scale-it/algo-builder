# [Algo Builder Web](https://algobuilder.dev/)

`@algo-builder/web` package allows you to interact with contracts easily. It is designed to be used with web dapps as well as scripts and user programs.

This package provides a class `WebMode` which has variety of high level functions like, [`waitForConfirmation`](algobuilder.dev/api/web/classes/web.html#waitForConfirmation), [`executeTx`](<(algobuilder.dev/api/web/classes/web.html#executeTx)>), [`signTransaction`](<(algobuilder.dev/api/web/classes/web.html#signTransaction)>), etc. These functions help sending transactions and building dapps.

You can use `@algo-builder/web` with [pipeline UI](https://www.pipeline-ui.com/docs/algocomponents/algobutton) to easily integrate with web wallets.

## Relation to algob

`algob` uses `@algo-builder/web` package. However It is not possible to use `algob` directly in a web app, because `algob` uses nodejs file system. Therefore we created a lightweight `@algo-builder/web` package to provide common functionality and support dapp development.

In the `@algo-builder/web` package we pass transaction [parameters](https://github.com/scale-it/algo-builder/blob/master/docs/guide/execute-transaction.md) in the same way as we do in `algob`.

## Important links

- [Home Page](https://algobuilder.dev/)
- [Web API Docs](https://algobuilder.dev/api/web/index.html)
- [User Docs](https://algobuilder.dev/guide/README)

## Using Web

`@algo-builder/web` can be included as a library using `yarn add @algo-builder/web` and then import it using `import * from '@algo-builder/web'`.

## Example

You can connect to `web` package in your react app by using different wallets. Currently supported wallets include:

1.  ### AlgoSigner:

    Create an instance of the `WebMode` class by passing `AlgoSigner` and the chain name.
```js
    const wcSession = new WebMode(AlgoSigner, CHAIN_NAME);
```
2.  ### MyAlgo Wallet:

    Create an instance of the `MyAlgoWalletSession` class by passing the walletURL(token, server, port) and connect it using `connectToMyAlgo`.


    ```js
    const walletURL = {
         token: token,
         host: host,
         port: port,
    }
    const wcSession = new MyAlgoWalletSession(walletURL)  
    await wcSession.connectToMyAlgo();
    ```


3.  ### Wallet Connect:

    Create an instance of the `WallectConnectSession` class by passing the walletURL(token, server, port) and create a new session using `create` and connect to it using `onConnect`.


    ```js
    const walletURL = {
         token: token,
         host: host,
         port: port,
    }
    const wcSession = new WallectConnectSession(walletURL);

    await wcSession.create(true);
    wcSession.onConnect((error, response) => console.log(error, response));
```

Now you can use it to execute a transaction:

```javascript
    const txParams = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccountAddr: fromAddress,
      toAccountAddr: toAddress,
      amountMicroAlgos: amount,
      payFlags: {},
    };
    let response = await wcSession.executeTx(txParams);
```

This code will create the transaction, let the user sign it using selected wallet and send it to the network.

You can also use `wcSession.sendTransaction()` or `wcSession.signTransaction()` in a react app.
The example using these wallets can be found [here] (https://github.com/scale-it/algo-builder-templates/tree/master/shop)

**NOTE**:

1. We don't support checkpoints yet. Currently `deployASA`, `deployApp` functions don't work. User should directly pass assetIndex, appIndex instead of asaName, appName.

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

```bash
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

## deployApp

`deployer.deployApp` deploys stateful smart contract. Read more about [`deployApp parameters`](https://algobuilder.dev/api/algob/interfaces/types.Deployer.html#deployApp)

### Example

```javascript
// deployment
const daoAppInfo = await deployer.deployApp(
	creator,
	{
	    appName: "DAO App" // app name passed here
        metaType: MetaType.File
	    approvalProgramFilename: "dao-app-approval.py",
	    clearProgramFilename: "dao-app-clear.py",
		localInts: 9,
		localBytes: 7,
		globalInts: 4,
		globalBytes: 2,
		appArgs: appArgs,
	},
	{},
	{},
);

// now during querying, you only need this app name
const appInfo = deployer.getApp("DAO App");
```

**Note:** We don't support checkpoints yet. Currently `deployASA`, `deployApp` functions don't work. User should directly pass assetIndex, appIndex instead of asaName, appName.
