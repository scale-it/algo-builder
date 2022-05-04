---
layout: splash
---

# Algob Console

Sometimes it's nice to work with your contracts interactively for testing and debugging purposes, getting network config, paths, or for executing transactions by hand.

`algob` provides you an easy way to do this via an interactive console, with your contracts available and ready to use.

## Usage

**NOTE:** Make sure you have installed [algob](https://github.com/scale-it/algo-builder#installation) and configured `algob` in your project. For creating and setting up a new project, click [here](https://github.com/scale-it/algo-builder#create-an-algob-project).

- To open console session run `algob console` in your project root.
- To select network add `--network networkName` to the command.(eg. `algob console --network localhost`)
- To exit `algob console` type `.exit`, `ctrl + D` or `ctrl + C` (twice).
- To clear REPL console, use `ctrl + L`.
- To enter multi-line mode type: `.break`.

After opening console, you should get the following:
![image](https://user-images.githubusercontent.com/33264364/122463488-48b80280-cfd3-11eb-91dc-81d628a52bc0.png)

## Globals

Following globals are available in an `algob console` REPL:

- `deployer` : algob deployer in run mode. User can access checkpoints, get logic signature, transferAlgos and all other functions supported by `algob deployer`.
- `algodClient` : `algosdk.Algodv2`- an instance of algorand driver based on the current network (default if `--network` flag is not passed).
- `algosdk` : User can access `algosdk` package functions using this object. (eg. `algosdk.encodeAddress(..)`)
- `algob` : all `algob` [exported](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/index.ts) functions (eg. `algob.mkAccounts(..)`, `algob.balanceOf(..) etc)`

# Example Walkthrough

For demonstration purpose, we will be using [`examples/asa`](https://github.com/scale-it/algo-builder/tree/master/examples/asa) project where user will be able to setup scripts and accounts, transfer algo's (in microalgos) & ASA between accounts, interact with smart signatures (contract account and delegation signature mode) using `algob console`.

- [Setup](./algob-console.md#setup)
- [Transfer Algos](./algob-console.md#transfer-algos)
- [Transfer Assets](./algob-console.md#transfer-assets)
- [Transfer Algos according to ASC logic (Contract Account)](./algob-console.md#transfer-algos-according-to-asc-logic-contract-account)
- [Transfer Assets according to ASC (Delegated Approval)](./algob-console.md#transfer-assets-according-to-asc-delegated-approval)

## Setup

In the `examples/asa` directory:

1. Follow the README file
2. deploy assets and smart contracts using `algob deploy`

This will deploy your assets (`gold` and `tesla` in this case) and store asc1 `logic signature` in checkpoint for delegated approval mode. Also, let's initialize some of the accounts which we will use in further transactions.

Open a console session using `algob console` and initialize `master account` using `deployer` object

```bash
algob> masterAccount = deployer.accountsByName.get("master-account")
```

![image](https://user-images.githubusercontent.com/33264364/97816308-735e8080-1cba-11eb-970d-50f8e3217d8f.png)

Similarly, initialize few more accounts (check `algob.config.js` for more details about accounts used in ASA template)

```bash
let goldOwner = deployer.accountsByName.get("alice");
let john = deployer.accountsByName.get("john");
let bob = deployer.accountsByName.get("bob");
```

You can also retreive asset information from checkpoints. Eg.

```bash
algob> deployer.asa
Map(1) {
  'gold' => {
    creator: 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY',
    txID: 'QBKYATG6Y7BS5A5NXE6OYRZ5B5TY22EOJC2UEK25GFMW5S7WVEVA',
    assetIndex: 25,
    confirmedRound: 3446,
    assetDef: {
      total: 5912599999515,
      decimals: 0,
      defaultFrozen: false,
      unitName: 'GLD',
      url: 'url',
      metadataHash: '12312442142141241244444411111133',
      note: 'note',
      noteb64: 'noteb64',
      manager: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
      reserve: '2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ',
      freeze: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
      clawback: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
      optInAccNames: [Array]
    }
  }
}
algob>
```

![image](https://user-images.githubusercontent.com/33264364/122483007-45cb0b00-cfef-11eb-887b-0514be84579c.png)

Now, we show how to use [`algob.executeTx`](https://github.com/scale-it/algo-builder/blob/develop/docs/guide/execute-transaction.md) to execute transactions in an Algorand Network.

## Transfer Algos

Here, we will transfer `1 Algo` from `masterAccount` to `john`. Code can be found in `/scrips/transfer/master-fund-john.js`.

Transaction params looks like :

```bash
algob> rtypes = algob.runtime.types
algob> algoTransferParams = {
...   type: rtypes.TransactionType.TransferAlgo,
...   sign: rtypes.SignType.SecretKey,
...   fromAccount: masterAccount,
...   toAccountAddr: john.addr,
...   amountMicroAlgos: 1e6,
...   payFlags: { note: 'ALGO PAID' }
... };
{
  type: 0,
  sign: 0,
  fromAccount: {
    name: 'master-account',
    addr: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
    sk: Uint8Array(64) [
       81, 210,  16, 184, 214, 254, 152, 138, 107, 191,  12,
      188, 175, 162,  72, 134,  82, 233, 249,  40,  97, 197,
      132,  81, 113,  16, 244,  19, 200, 221, 193, 155, 181,
      176, 219, 238, 106, 134,  42,  72, 146, 178, 183, 161,
        7, 238,  87, 145,  92,  34, 110,  74, 164, 136, 138,
      167, 248,   1, 168, 242,   0,  77,  71, 104
    ]
  },
  toAccountAddr: '2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA',
  amountMicroAlgos: 1000000,
  payFlags: { note: 'ALGO PAID' }
}
```

![image](https://user-images.githubusercontent.com/33264364/122477861-09df7800-cfe6-11eb-9aa9-c99c04011d06.png)

Executing the transaction above gives the following result:

```bash
algob> await algob.executeTx(deployer, algoTransferParams);
{
  'confirmed-round': 3727,
  'pool-error': '',
  'receiver-rewards': 184,
  'sender-rewards': 3997582,
  txn: {
    sig: Uint8Array(64) [
       57, 175,  29, 200,  41, 197,  17, 105,  16,   6, 207,
      212, 234,  17,  11, 212, 103, 128, 253,  57,  65, 153,
       47,  59, 220, 182, 226, 212,  35,  72, 248, 103, 123,
       76,   1, 223, 193, 196, 117, 231, 147,  45,  80,  53,
      104, 133, 229, 135, 144, 198,  21, 238,  73, 253, 177,
      135, 114, 142,  42,  36,  42,  97, 130,  11
    ],
    txn: {
      amt: 1000000,
      fee: 257000,
      fv: 3725,
      gen: 'private-v1',
      gh: [Uint8Array],
      lv: 4725,
      note: [Uint8Array],
      rcv: [Uint8Array],
      snd: [Uint8Array],
      type: 'pay'
    }
  }
}
```

![image](https://user-images.githubusercontent.com/33264364/122478061-5a56d580-cfe6-11eb-9bb4-7e2329dd7037.png)

## Transfer Assets

We will transfer a single unit of `gold` ASA (which we deployed during the setup) from `goldOwner` to `john`. Relevant code can be found in `/scrips/transfer/gold-to-john.js`.

Let's use `.editor` mode of REPL to write & execute multiple lines of code at once:

```bash
algob> .editor
// Entering editor mode (Ctrl+D to finish, Ctrl+C to cancel)
const rtypes = algob.runtime.types;
const gold = deployer.asa.get('gold'); // asa info from checkpoint
const goldOwner = deployer.accountsByName.get('alice');
const john = deployer.accountsByName.get('john');
algob.executeTx(deployer, {
  type: rtypes.TransactionType.TransferAsset,
  sign: rtypes.SignType.SecretKey,
  fromAccount: goldOwner,
  toAccountAddr: john.addr,
  amount: 1,
  assetID: gold.assetIndex,
  payFlags: {}
});
```

![image](https://user-images.githubusercontent.com/33264364/122479488-c8040100-cfe8-11eb-8f42-291459fd6c69.png)

After transferring ASA, you can also check the balance (asset holding) of `john` using `algob.balanceOf(..)`

```bash
algob> await algob.balanceOf(deployer, john.addr, gold.assetIndex);
```

![image](https://user-images.githubusercontent.com/33264364/122479899-7a3bc880-cfe9-11eb-99f2-e7ad70e2646f.png)

Similar example can be found in `/scrips/transfer/tesla-to-john.js` (tesla ASA).

## Transfer Algos according to ASC logic (Contract Account)

Here we will transfer some `algos` from a stateless smart contract ([`/assets/teal/2-gold-contract-asc.teal`](https://github.com/scale-it/algo-builder/blob/develop/examples/asa/assets/teal/2-gold-contract-asc.teal)) to `john`.

- We will first load the smart signature (using `deployer.loadLogicByFile(<file_name>.teal)` and get it's address(`lsig.address()`). It is worth noting that you can use `mkContractLsig` to save your lsig info against a "name" (eg. `myLsig`), and directly use `deployer.getLsig` to query Lsig information from a checkpoint. Eg.

  ```js
  // store contract lsig
  await deployer.mkContractLsig("CLsig", "file.py", { ARG_DAO_APP: 1 });

  // now during querying, you only need this lsig name
  const lsigInfo = deployer.getLsig("CLsig");
  ```

- This address will be the sender(contract account mode) and receiver will be `john`.
- Finally, we will transfer some algos using `algob.executeTx(..)` function. Transaction will pass/fail according to asc logic.

```js
// by file
lsig = await deployer.loadLogicByFile("2-gold-contract-asc.teal");
sender = lsig.address();

// by name
// store contract lsig in checkpoint (in deploy script)
await deployer.mkContractLsig("GoldASC", "2-gold-contract-asc.teal");

// now during querying, you only need this lsig name
const lsigInfo = deployer.getLsig("GoldASC");
```

![image](https://user-images.githubusercontent.com/33264364/97818537-e3740300-1cc8-11eb-81cd-a64e80106cf7.png)

The contract ensures that amount in microalgos must be <=100, otherwise the transaction will be rejected.

Transaction Pass:

```bash
algob> .editor
// Entering editor mode (Ctrl+D to finish, Ctrl+C to cancel)
// Transactions for Transaction for ALGO - Contract : '2-gold-contract-asc.teal'  (Contract Mode)
// sender is contract account
const algoTxParam = {
  type: rtypes.TransactionType.TransferAlgo,
  sign: rtypes.SignType.LogicSignature,
  fromAccountAddr: lsig.address(),
  toAccountAddr: john.addr,
  amountMicroAlgos: 20n, // amt <= 100
  lsig: lsig,
  payFlags: { totalFee: 1000 }
};

// Transaction PASS - As according to .teal logic, amount should be <= 100
algob.executeTx(deployer, algoTxParam);

{
  'confirmed-round': 4418,
  'pool-error': '',
  'receiver-rewards': 93,
  'sender-rewards': 1,
  txn: {
    lsig: { l: [Uint8Array] },
    txn: {
      amt: 20,
      fee: 1000,
      fv: 4416,
      gen: 'private-v1',
      gh: [Uint8Array],
      lv: 5416,
      rcv: [Uint8Array],
      snd: [Uint8Array],
      type: 'pay'
    }
  }
}
```

Transaction fail:

```bash
algob> .editor
// Entering editor mode (Ctrl+D to finish, Ctrl+C to cancel)
const invalidTxnParams = {
  type: rtypes.TransactionType.TransferAlgo,
  sign: rtypes.SignType.LogicSignature,
  fromAccountAddr: lsig.address(),
  toAccountAddr: john.addr,
  amountMicroAlgos: 200, // amt > 100
  lsig: lsig,
  payFlags: { totalFee: 1000 }
};

// Transaction FAIL - rejected by logic. According to .teal logic, amount should be <= 100
algob.executeTx(deployer, invalidTxnParams);

// rejected by logic
Error: Bad Request
    at Request.callback (/home/ratik/Scale-it/algo-builder/node_modules/superagent/src/node/index.js:879:15)
    at fn (/home/ratik/Scale-it/algo-builder/node_modules/superagent/src/node/index.js:1130:18)
    at IncomingMessage.<anonymous> (/home/ratik/Scale-it/algo-builder/node_modules/superagent/src/node/parsers/json.js:19:7)
...
```

Code can be found in `/scripts/transfer/gold-contract-sc.js`

## Transfer Assets according to ASC (Delegated Approval)

Here, we will first transfer some Algorand Standard Assets(ASA) from `goldOwner` (delegating authority in this case) to `john` according to asc `/assets/4-gold-asa.teal`.
`goldOwner` is the delegating authority here, as during deployment (`algob deploy`) the smart contract's logic signature was signed by this account (check `/scripts/2-gold-asc.js`).

Logic signature (stored in checkpoint) is retreived using `deployer.getLsig('<file_name>.teal'`).
Assets are transferred using `algob.executeTx({ type: TransactionType.TransferAsset, ...})`.

Retreive lsig & assetId from checkpoint:

```bash
// you can load by name as well (using name is GOLD_ASA):
// algob> lsigGoldOwner = deployer.getLsig('GOLD_ASA');
algob> lsigGoldOwner = deployer.getLsig('4-gold-asa.teal');
LogicSig {
  tag: [
     80, 114, 111,
    103, 114,  97,
    109
  ],
  logic: [
     2,  32,   5,   1,   0,   4, 232,   7, 144,  78,  38,   1,
    32,  32, 238, 110,  24, 193,  33, 202, 182, 223, 192, 249,
    77,  61, 151, 217, 220, 224, 100,  83, 214, 173,  82, 215,
    92, 216,  93,  91,  53, 216, 110,  17,  18,  50,   4,  34,
    18,  49,  22,  35,  18,  16,  49,  18,  35,  18,  16,  49,
    16,  36,  18,  49,   0,  40,  18,  16,  49,  18,  37,  14,
    16,  17,  49,  16,  36,  18,  49,  32,  50,   3,  18,  16,
    49,   9,  50,   3,  18,  16,  49,   1,  33,   4,  14,  16,
    16
  ],
  args: [],
  sig: Uint8Array(64) [
     91, 218, 167,  24,  16, 245,  64, 176, 167, 113, 206,
    221,  37, 222, 184, 149,  22, 193, 197, 144,  50,  10,
    135, 207, 224,  74, 210, 194, 107,  66, 184, 151, 223,
    231, 203, 197, 255, 193, 187, 106, 184, 190, 204, 229,
     79, 143,  63, 255, 193,  56,  22,  46,  23, 200, 253,
     43, 126,  92, 137,  50,  26, 141, 222,  13
  ],
  msig: null
}
algob> assetID =  deployer.asa.get("gold").assetIndex;
25
algob>
```

Here, the smart contract rejects a transaction if Asset Amount > 1000. Transactions for passing & failing scenario are shown below :-

```
algob> .editor
// Entering editor mode (Ctrl+D to finish, Ctrl+C to cancel)
let validParams = {
  type: rtypes.TransactionType.TransferAsset,
  sign: rtypes.SignType.LogicSignature,
  fromAccountAddr: goldOwner.addr,
  toAccountAddr: john.addr,
  amount: 500,
  assetID: 'gold', // passing asa name is also supported
  lsig: lsigGoldOwner,
  payFlags: { totalFee: 1000 }
};

// Transaction PASS
algob.executeTx(deployer, validParams);

{
  'confirmed-round': 4628,
  'pool-error': '',
   ...
}

algob> .editor
// Entering editor mode (Ctrl+D to finish, Ctrl+C to cancel)
validParams.amount = 1500;

// Transaction FAIL
algob.executeTx(deployer, validParams);

Error: Bad Request
    at Request.callback (/home/ratik/Scale-it/algo-builder/node_modules/superagent/src/node/index.js:879:15)
    at fn (/home/ratik/Scale-it/algo-builder/node_modules/superagent/src/node/index.js:1130:18)
...
```

Code can be found in `/scripts/transfer/gold-delegated-lsig.js`

**All smart contracts used in these examples can be found in `/assets` folder and scripts in `/scripts/transfer` folder.**
