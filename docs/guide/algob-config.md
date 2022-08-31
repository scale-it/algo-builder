---
layout: splash
---

# Algob Config

Algo Builder project must have an `algob.config.js` file present in a root directory. You can use the [sample file](https://github.com/scale-it/algo-builder/blob/master/packages/algob/sample-project/common/algob.config.js).
The config is used to list available algorand networks, accounts and how to connect to them.

A network object specifs the following entries:

- `accounts` - list of `algosdk.Account` objects (required)
- `host` (string, required, can be with http or https prefix)
- `port` (number, required)
- `token` (required, default `none`)
- `httpHeaders` -- HTTP headers attached to every raw transaction request (optional, default `none`)

_NOTE:_ `token` can be passed directly as a `string`, or as an object. Eg

```js
token: {
  "X-Algo-API-Token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

A special network named `algobchain` can specify the `AlgobChain` configuration:

```ts
accounts_file?: string;
throwOnTransactionFailures?: boolean;
throwOnCallFailures?: boolean;
loggingEnabled?: boolean;
initialDate?: string;
```

## Network Credentials

If you are running a local node, you can find port and token values for your algod in `$ALGORAND_DATA/algod.net` and `$ALGORAND_DATA/algod.token` files.

You can specify **Algod** [Network Credentials](https://algobuilder.dev/api/algob/interfaces/types.NetworkCredentials.html) manually or you can load it from ENV.

- Method 1: specify manually:

        let algodCred = {host: "127.0.0.1", port: 4001, token: "c3e..."}

- Method 2: use host address and token from environment:

  - Set `ALGOD_ADDR` and `ALGOD_TOKEN` in your shell environment:

        export ALGOD_ADDR = "127.0.0.1:4001"
        export ALGOD_TOKEN = "algod_token"

  - Load credentials in algob config:

        let algodCred = algodCredentialsFromEnv();

- Method 3: load from Algorand data directory.

  - Set `ALGORAND_DATA` in your shell environment:

          export ALGORAND_DATA="path_to/algorand-node-data"

  - Load credentials in algob config (same function as in method_2):

          let algodCred = algodCredentialsFromEnv();

Similarly, **KMD** uses [Network Credentials](https://algobuilder.dev/api/algob/interfaces/types.NetworkCredentials.html) object:

- Method 1: specify manually:

        let kmdCred = {host: "127.0.0.1", port: 7833, token: "c3e..."}

- Method 2: use host address and token from environment:

  - Set `KMD_ADDR` and `KMD_TOKEN` in env, you can use the following command in terminal:

        export KMD_ADDR = "127.0.0.1:7833"
        export KMD_TOKEN = "kmd_token"

  - Load credentials in algob config:

        let kmdCred = KMDCredentialsFromEnv();

- Method 3: load from KMD data directory.

  - Set `KMD_DATA` (usually it's in your node data directory) in your shell environment:

          export KMD_DATA = "path_to/kmd-vX"

  - Load credentials in algob config (same function as in method_2):

          let kmdCred = KMDCredentialsFromEnv();

## Accounts

Each network configuration requires a list of accounts. These accounts are then available in scripts and in a console. Accounts can be created by:

1.  Initializing a native `algosdk.Account` object. Example:

        const account = {
          name: 'master',
          addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
          sk: new Uint8Array([28,  45,  45,  15,  70, 188,  57, 228,  18,  21,  42, 228,  33, 187, 222, 162,  89,  15,  22,  52, 143, 171, 182,  17, 168, 238,  96, 177,  12, 163, 243, 231, 160, 203, 241, 203, 176, 185,   4,  26,  16, 101, 217, 179, 83, 157, 119,  28,  82, 234, 204, 209, 249,  29,  28, 24,  97, 122, 116,  86, 135, 163, 236, 253]) }

1.  Loading from a file (you can generate a test accounts using `gen-accounts` command). `algob` should be available in your node_modules.

        const { loadAccountsFromFileSync } = require("@algo-builder/algob");
        const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");

1.  A mnemonic string:

        const { mkAccounts } = require("@algo-builder/algob");
        let accounts = mkAccounts([{
          name: "gold",
          addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
          mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
        }]);

    You can extract private keys from KMD through mnemonic phrase using `goal` command. However, we recommend not doing that and using the KMD client directly to avoid writing a plaintext menmonic in a config file.

        goal -d $(ALGORAND_DATA) account list
        goal -d $(ALGORAND_DATA) account export -a <account address>

1.  Loading from a Key Management Daemon (KMD).
    You will have to specify KMD config and provide it to each network you want to expose your KMD accounts. `algob` will connect to the KMD client and load accounts with
    specified addresses and assign names to that account according to the `kmdCfg`. If an
    account with same name is already listed in given `network.accounts` then KMD loader will
    ignore that account. Similarly, account will be ignored if KMD wallet doesn't have a
    specified address.
    Please see the [KmdCfg type](https://algobuilder.dev/api/algob/interfaces/types.KmdCfg.html) documentation for details.

         // KMD credentials
         let kmdCfg = {
           // host, port and token can be loaded using `KMDCredentialsFromEnv`
           // as described in the previous section
           host: "127.0.0.1",
           port: 7833,
           token: "09c2da31d3e3e96ed98ba22cc4d58a14184f1808f2b4f21e66c9d38f70ca7232",
           wallets: [
             {name: "unencrypted-default-wallet",
              password: "",
              accounts: [
                {name: "abc", address: "DFDZU5FACMC6CC2LEHB5H4HYS7OQDKDXP5SHTURSVF43XUGBQVQCQJYZOU"}]}
           ]
         }

         let myNetwork = {
           host: "http://localhost",
           port: 8080,
           token: "55e1b3b85b7ca6a755a6a01509fca40bdb52b5dc120da07b9c196ab7d364ff66",
           accounts: accounts,
           kmdCfg: kmdCfg,  // <-- if kmdCfg is ignored, algob won't connect to KMD nor load KMD accounts
         };

         // you can create a KMD client if needed in the scripts:
         // let kmd = new algosdk.Kmd(kmdcfg.token, kmdcfg.host, kmdcfg.port)

1.  Loaded from `ALGOB_ACCOUNTS` shell environment variable:
    The keys in env variable should be JSON string of the following structure:

        [{"name": "account_name", "menmonic": "mnemonic string"}]

    Use the following command to load accounts from environment:

        const { loadAccountsFromEnv } = require("@algo-builder/algob");
        const accounts = loadAccountsFromEnv();

NOTE: don't use any of the accounts above. They are provided only as an example - everyone has an access to them!

You can merge accounts in the config file (eg by using `concat` method on an `Array`).
You can also construct different accounts for different networks.

## Indexer

You can add the indexer config in your network config `indexerCfg`. You can use the client with the `deployer` object (`dedployer.indexerClient`) in `algob` scripts.

To start indexer for a local development network, please refer to our [`infrastructure`](https://github.com/scale-it/algo-builder/tree/master/infrastructure#indexer-v2) scripts.

Eg.

```js
const indexerCfg = {
  host: "http://localhost",
  port: 8980, // indexer port
  token: { "X-Algo-API-Token": "" }
};

let defaultCfg = {
  host: "http://localhost",
  port: 4001,
  token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  accounts: accounts,
  indexerCfg: indexerCfg
};

module.exports = {
 networks: {
  default: defaultCfg
  ..
 }
}
```

Now in a an algob script, you can use `deployer.indexerClient`. Eg.

```js
async function run (runtimeEnv, deployer) {
  console.log('Script has started execution!');

  const iClient = deployer.indexerClient;
  const health = await iClient.makeHealthCheck().do();
```

## Example

```js
const { loadAccountsFromFileSync } = require("@algo-builder/algob");
const { privateNet } = require("algo-builder/config");

const accounts = loadAccountsFromFileSync("assets/accounts_generated.yaml");
const mainnetAccounts = loadAccountsFromFileSync("private/accounts/mainnet.yaml");

var myprivateNet = {
	host: "http://127.0.0.1",
	port: 4001,
	token: "abc",
	accounts: accounts,
};

module.exports = {
	/**
	 * Networks define how you connect to your Algorand node. By default the
	 * `development` network is used.
	 */
	networks: {
		// You can run an algorand node in a separate terminal, or use `algob` to run and
		// configure your private-net. If `development` network is not specified, `algob`
		// will use the internal `privateNet` configuration for the development network.
		development: myprivateNet,
		privateNet: privateNet,
		testnet: {
			host: "127.0.0.1",
			port: 9545,
			token: "3ff96e84dd5c041aa79cbb8e876d86ac73ec337b97977261aeb92c6e6a7f2725",
			accounts: mainnetAccounts,
		},
	},

	// Set default mocha options here, use special reporters etc.
	mocha: {
		// timeout: 100000
	},
};
```
