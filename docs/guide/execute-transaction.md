---
layout: splash
---

# Execute Transaction

`executeTx` is a high level method of Deployer  which can be used to perform transactions on Algorand Network. It supports every transaction (atomic or single) which is possible in network. Ex: Deploy ASA/App, Opt-In, Transfers, Delete, Destroy etc. `executeTx` takes `ExecParams[]` as parameter.
If the lenght of `ExecParams` array is greater than one, it will be considered as `atomic transaction`.
In below sections we will demonstrate how to pass these parameters.

Note: For each parameter `type` and `sign` fields are mandatory.

- `type`: type of transaction
- `sign`: sign type

Examples of parameter [`ExecParams`](https://algobuilder.dev/api/algob/modules/runtime.types.html#ExecParams):

### [Transfer Algo using secret key](https://algobuilder.dev/api/algob/modules/runtime.types.html#AlgoTransferParam)

```js
  {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: john,
    toAccountAddr: alice.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: fee }  }
```

- payFlags: [TxParams](https://algobuilder.dev/api/algob/interfaces/runtime.types.TxParams.html)

### [Transfer Algo using logic signature](https://algobuilder.dev/api/algob/modules/runtime.types.html#AlgoTransferParam)


```js
  {
    type: TransactionType.TransferAlgo,
    sign: SignType.LogicSignature,
    fromAccountAddr: contractAddress,
    toAccountAddr: alice.address,
    amountMicroAlgos: 100,
    lsig: lsig,
    payFlags: { totalFee: fee }
  }
```

### [Deploy ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#DeployASAParam)

To deploy an ASA using `asa.yaml`:

```js
  {
    type: TransactionType.DeployASA,
    sign: SignType.SecretKey,
    fromAccount: john,
    asaName: 'gold',
    payFlags: { totalFee: fee }
  }
```

To deploy an ASA without using `asa.yaml`:

```js
  {
    type: types.TransactionType.DeployASA,
    sign: types.SignType.SecretKey,
    fromAccount: john.account,
    asaName: 'silver-12',
    asaDef: {
      total: 10000,
      decimals: 0,
      defaultFrozen: false,
      unitName: "SLV",
      url: "url",
      metadataHash: "12312442142141241244444411111133",
      note: "note"
    },
    payFlags: {}
  };
```

### [Opt-In to ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#OptInASAParam)

```js
  {
    type: TransactionType.OptInASA,
    sign: SignType.SecretKey,
    fromAccount: alice,
    assetID: assetIndex,
    payFlags: { totalFee: fee }
  }
```

### [Transfer Asset](https://algobuilder.dev/api/algob/modules/runtime.types.html#AssetTransferParam)

```js
  {
    type: TransactionType.TransferAsset,
    sign: SignType.SecretKey,
    fromAccount: john,
    toAccountAddr: alice.address,
    amount: 10,
    assetID: assetId,
    payFlags: { totalFee: fee }
  }
```

### [Deploy App](https://algobuilder.dev/api/algob/modules/runtime.types.html#DeployAppParam)

```js
  {
    type: TransactionType.DeployApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    approvalProgram: approvalProgram,
    clearProgram: clearProgram,
    localInts: 1,
    localBytes: 1,
    globalInts: 1,
    globalBytes: 1,
    payFlags: {}
  }
```

- To learn about more parameters like (account, appArgs, ForeignApps, ForeignAssets etc).Please check [AppOptionalFlags](https://algobuilder.dev/api/algob/interfaces/runtime.types.AppOptionalFlags.html)

### [Opt-In to App](https://algobuilder.dev/api/runtime/classes/Runtime.html#optInToApp)

```js
  {
    type: TransactionType.OptInToApp,
    sign: SignType.SecretKey,
    fromAccount: alice,
    appID: appID,
    payFlags: { totalFee: fee }
  }
```

### [Call App](https://algobuilder.dev/api/algob/modules/runtime.types.html#AppCallsParam)

```js
  {
    type: TransactionType.CallNoOpApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appId: 0,
    payFlags: { totalFee: fee }
  }
```

### [Update App](https://algobuilder.dev/api/algob/modules/runtime.types.html#UpdateAppParam)

```js
  {
    type: TransactionType.updateApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appID: appId,
    newApprovalProgram: newApprovalProgram,
    newClearProgram: newClearProgram,
    payFlags: {}
  }
```

### [Delete App](https://algobuilder.dev/api/algob/modules/runtime.types.html#AppCallsParam)

```js
  {
    type: TransactionType.DeleteApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appId: 10,
    payFlags: { totalFee: fee },
    appArgs: []
  }
```

### Pooled Transaction Fees

With [this](https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/) release, algob also supports pooled transaction fees.
Algob now supports pooled fees where one transaction can pay the fees of other transactions within an atomic group. For atomic transactions, the protocol sums the number of transactions and calculates the total amount of required fees, then calculates the amount of fees submitted by all transactions. If the collected fees are greater than or equal to the required amount, the transaction fee requirement will be met.
Ex:

```js
  {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccountAddr: john,
    toAccountAddr: alice.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 2000 }
  },
  {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccountAddr: alice,
    toAccountAddr: bob.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: 0 }
  }
```

Even though fee paid by alice is `0`, this transaction will pass because total fees collected is greater than or equal to the required amount.

## Sign and Send SDK Transaction object using `executeTx` function

`executeTx` function supports signing and sending sdk transaction objects. To do this you will have to pass an [`TransactionAndSign`](https://algobuilder.dev/api/web/interfaces/types.TransactionAndSign.html) object which has `transaction` and `sign`. Ex:

```
const tx = makeAssetCreateTxn(
  bobAcc.addr, mockSuggestedParam.fee,
  mockSuggestedParam.firstRound, mockSuggestedParam.lastRound,
  undefined, mockSuggestedParam.genesisHash, mockSuggestedParam.genesisID,
  1e6, 0, false, undefined, undefined, undefined, undefined, "UM", "ASM", undefined
);
const transaction: wtypes.TransactionAndSign = {
  transaction: tx,
  sign: {sign: wtypes.SignType.SecretKey, fromAccount: bobAcc}
}

const res = await deployer.executeTx([transaction]);
```

You can check the implementation in [asa](https://github.com/scale-it/algo-builder/blob/master/examples/asa/scripts/2-gold-asc.js) example.

## SignTransactions function

This function takes array of [`TransactionAndSign`](https://algobuilder.dev/api/web/interfaces/types.TransactionAndSign.html) objects and returns raw signed transaction

```
const transaction: wtypes.TransactionAndSign = [{
  transaction: SDKTx,
  sign: {sign: wtypes.SignType.SecretKey, fromAccount: bobAcc}
}]
const rawSign = signTransactions(transaction)
```

`rawSign` has array of raw signed transactions.
You can check the implementation in [asa](https://github.com/scale-it/algo-builder/blob/master/examples/asa/scripts/2-gold-asc.js) example.
