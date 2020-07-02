# algob config

Algorand builder project must have an `algob.config.js` file present in a root directory.
The config is used to list available algorand networks and instructions how to connect to them.

A network object can specify following entries:

+ `host` (string, required, can be with http or https prefix)
+ `port` (number, required)
+ `token` (required, default `none`)
+ `httpHeaders` -- HTTP headers attached to every raw transaction request (optional, default `none`)

A special network named `algobchain` can specify the `AlgobChain` configuration:

```
  accounts?: NetworkAccounts;
  throwOnTransactionFailures?: boolean;
  throwOnCallFailures?: boolean;
  loggingEnabled?: boolean;
  initialDate?: string;
```

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
      token: {'X-API-Key': 'YOUR API KEY HERE'},
      httpHeaders: {'content-type' : 'application/x-binary'}
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  }
}
```
