---
layout: splash
---

# PureStake

[PureStake's](https://developer.purestake.io/) API-As-A-Service provides access to native Algorand REST APIs for MainNet, TestNet and BetaNet. You need to sign up to have an API KEY (required for making requests).

## Using purestake api with algob

Purestake API's can be easily integrated with `algo-builder` scripts. You just need to add relevent config (host, token) in your `algob.config.js`. Currently purestake offers the Algorand `Algod v2`, and Indexer APIs via service, and not the `KMD` API.


*NOTE:* PureStake's API does not work with the Algorand SDK code examples - requiring an alternate header value 'X-API-Key' in place of the default 'X-Algo-API-Token' (example shown in below section).

## AlgodV2

For algodv2, the host urls for mainnet, testnet & betanet are:
+ *mainnet*: `https://mainnet-algorand.api.purestake.io/ps2`
+ *testnet*: `https://testnet-algorand.api.purestake.io/ps2`
+ *betanet*:  `https://betanet-algorand.api.purestake.io/ps2`

Your API KEY will be present in your purestake.io [dashboard](https://developer.purestake.io/home).

For example, if we want to access purestake testnet API, let's add a new network configuration in `algob.config.js`:

```js
let purestakeTestNetCfg = {
  host: "https://testnet-algorand.api.purestake.io/ps2",
  port: '',
  token: {
    'X-API-Key': 'B3SU4KcVKi94Jap2VXkK83xx38bsv95K5UZm2lab' // replace this with your API key
  },
  accounts: [] // accounts can be passed as an empty array as well
};

module.exports = {
  networks: {
    default: defaultCfg,
    purestake: purestakeTestNetCfg
  }
};
```

And while running the script, you can simply pass this cfg with the `--network` flag. (eg. `algob run scripts/run.js --network purestake`).

## IndexerV2

For indexer, the host urls for mainnet, testnet & betanet are:
+ *mainnet*: `https://mainnet-algorand.api.purestake.io/idx2`
+ *testnet*: `https://testnet-algorand.api.purestake.io/idx2`
+ *betanet*: `https://betanet-algorand.api.purestake.io/idx2`

Similar to above section, you can add this config in `algob.config.js`, and access the API via `deployer.indexerClient` in an `algob` script.

```js
let purestakeIndexerCfg = {
  host: "https://testnet-algorand.api.purestake.io/idx2",
  port: '',
  token: {
    'X-API-Key': 'B3SU4KcVKi94Jap2VXkK83xx38bsv95K5UZm2lab' // replace this with your API key
  },
  accounts: [] // accounts can be passed as an empty array as well
};

module.exports = {
  networks: {
    purestake: purestakeIndexerCfg
  }
};
```
