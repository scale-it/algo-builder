# algob config

Algorand builder project must have an `algob.config.js` file present in a root directory.
The config is used to list available algorand networks and instructions how to connect to them.

A network object can specify following entries:

+ `accounts` - list of `algosdk.Account` objects (required)
+ `host` (string, required, can be with http or https prefix)
+ `port` (number, required)
+ `token` (required, default `none`)
+ `httpHeaders` -- HTTP headers attached to every raw transaction request (optional, default `none`)

A special network named `algobchain` can specify the `AlgobChain` configuration:

```
accounts_file?: string;
throwOnTransactionFailures?: boolean;
throwOnCallFailures?: boolean;
loggingEnabled?: boolean;
initialDate?: string;
```

## Credentials

You can specify Algod Credentials in network object or you can load it from ENV.
To load it from ENV:

- Method 1

  - To add `ALGOD_ADDR` and `ALGOD_TOKEN` in env, you can use the following commands in terminal:

        export ALGOD_ADDR = "127.0.0.1:8080"
        export ALGOD_TOKEN = "algod_token"

  - To load algod credentials from env in config, you can use:

        let algodCred = algodCredentialsFromEnv();

- Method 2

  - To add `$ALGORAND_DATA` in env, you can use the following command in terminal:

          export $ALGORAND_DATA = "content_of/algorand-node-data"

  - To load algod credentials from env in config, you can use:

          let algodCred = algodCredentialsFromEnv();

Similarly for KMD credentials you can either specify credentials in KMD object or load it from ENV.
To load it from ENV:

- Method 1

  - To add `KMD_ADDR` and `KMD_TOKEN` in env, you can use the following commands in terminal:

        export KMD_ADDR = "127.0.0.1:8080"
        export KMD_TOKEN = "kmd_token"

  - To load kmd credentials from env in config, you can use:

        let kmdCred = KMDCredentialsFromEnv();

- Method 2

  - To add `$KMD_DATA` in env, you can use the following command in terminal:

          export $KMD_DATA = "content_of/kmd-data"

  - To load kmd credentials from env in config, you can use:

          let kmdCred = KMDCredentialsFromEnv();

## Accounts

Each network configuration requires a list of accounts. These accounts are then available in scripts and in a console. Accounts can be created by:

1. Initializing a native `algosdk.Account` object. Example:

        const account = {
          name: 'master',
          addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
          sk: new Uint8Array([28,  45,  45,  15,  70, 188,  57, 228,  18,  21,  42, 228,  33, 187, 222, 162,  89,  15,  22,  52, 143, 171, 182,  17, 168, 238,  96, 177,  12, 163, 243, 231, 160, 203, 241, 203, 176, 185,   4,  26,  16, 101, 217, 179, 83, 157, 119,  28,  82, 234, 204, 209, 249,  29,  28, 24,  97, 122, 116,  86, 135, 163, 236, 253]) }

1. Loading from a file (you can generate a test accounts using `gen-accounts` command). `algob` should be available in your node_modules.

        const { loadAccountsFromFileSync } = require("algob");
        const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");

1. A mnemonic string:

        const { mkAccounts } = require("algob");
        let accounts = mkAccounts([{
          name: "gold",
          addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
          mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
        }]);

  You can extract private keys from KMD through mnemonic phrase using `goal` command. However, we recommend not doing that and using the KMD client directly to avoid writing a plaintext menmonic in a config file.

        goal -d $(ALGORAND_DATA) account list
        goal -d $(ALGORAND_DATA) account export -a <account address>

1. Loading from a Key Management Daemon (KMD).
   You will have to specify KMD config and provide it to each network you want to expose some
   of your KMD accounts. `algob` will connect to the KMD client and load accounts with
   specified addresses and assign names to that account according to the `kmdCfg`. If an
   account with same name is already listed in given `network.accounts` then KMD loader will
   ignore that account. Similarly, account will be ignored if KMD wallet doesn't have a
   specified address.
   Please see the [KmdCfg type](https://scale-it.github.io/algorand-builder/interfaces/_types_.kmdcfg.html) documentation for details.

        // KMD credentials
        let kmdCfg = {
          host: "127.0.0.1",
          port: 7833,
          token: "09c2da31d3e3e96ed98ba22cc4d58a14184f1808f2b4f21e66c9d38f70ca7232",
          wallets: [
            {name: "unencrypted-default-wallet", password: "",
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

1. Loaded from `ALGOB_ACCOUNTS` shell environment variable:
    The keys in env variable should be JSON string of the following structure:

        [{"name": "account_name", "menmonic": "mnemonic string"}]

    Use the following command to load accounts from environment:

        const { loadAccountsFromEnv } = require("algob");
        const accounts = loadAccountsFromEnv();


NOTE: don't use any of the accounts above. They are provided only as an example - everyone has an access to them!

You can merge accounts in the config file (eg by using `concat` method on an `Array`).
You can also construct different accounts for different networks.


## Example

```

const { loadAccountsFromFileSync } = require("algob");
const {privateNet} = require("algorand-builder/config")

const accounts = loadAccountsFromFileSync("assets/accounts_generated.yaml");
const mainnetAccounts = loadAccountsFromFileSync("private/accounts/mainnet.yaml");

var myprivateNet = {
     host: "http://127.0.0.1",
     port: 8080,
     token: "abc",
     accounts: accounts
}

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
      accounts: mainnetAccounts
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  }
}
```
