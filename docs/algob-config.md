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


## Accounts

Each network configuration requires a list of accounts. These accounts are then available in scripts and in a console. An account can be constructed by:

1. Initializing a native `algosdk.Account` object. Example:

        const account = {
          name: 'master'
          addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
          sk: new Uint8Array([28,  45,  45,  15,  70, 188,  57, 228,  18,  21,  42, 228,  33, 187, 222, 162,  89,  15,  22,  52, 143, 171, 182,  17, 168, 238,  96, 177,  12, 163, 243, 231, 160, 203, 241, 203, 176, 185,   4,  26,  16, 101, 217, 179, 83, 157, 119,  28,  82, 234, 204, 209, 249,  29,  28, 24,  97, 122, 116,  86, 135, 163, 236, 253]) }

1. Loaded from a file (you can generate a test accounts using `gen-accounts` command). `algob` has to be available in your node_modules.

        const { loadAccountsFromFileSync } = require("algob");
        const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");

1. Created from a mnemonic string:

        const { mkAccounts } = require("algob");
        let accounts = mkAccounts([{
          name: "gold",
          addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
          mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
        }]);

1. Loaded from Key Management Daemon (KMD)

        // KMD credentials
        let KMDConfig = {
          host: "127.0.0.1",
          port: 12345,
          token: "sfsdtoken"
        }

        let wallet = {
          name: "TESTWALLET",
          password: "testpassword"
        }

        let kmdAddresses = loadKMDAddresses(KMDConfig.host, KMDConfig.token, KMDConfig.port, 
          wallet.name, wallet.password);
        console.log(kmdAddresses);

NOTE: don't use any of the accounts above. They are provided only as an example - everyone has an access to them!

You can merge accounts in the config file (eg by using `concat` method on an `Array`).
You can also construct different accounts for different networks.


## Example

```

const {devnet} = require("algorand-builder/config")

var mydevnet = {
     host: "http://127.0.0.1",
     port: 8080,
     token: "abc",
}


module.exports = {
  /**
   * Networks define how you connect to your Algorand node. By default the
   * `development` network is used.
   */
  networks: {
    // You can run an a algorand node a separate terminal, or use `algob` to run and
    // configure for you a devnet. If `development` network is not specified, `algob`
    // will use the internal `devnet` configuration for development network.
    development: mydevnet,
    devnet: devnet,
    testnet: {
      host: "127.0.0.1",
      port: 9545,
      token: "3ff96e84dd5c041aa79cbb8e876d86ac73ec337b97977261aeb92c6e6a7f2725"
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  }
}
```
