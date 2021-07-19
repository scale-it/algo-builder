---
layout: splash
---

# Execute Transaction

`executeTransaction` is a high level function which can be used to perform transactions on Algorand Network. It supports every transaction (atomic or single) which is possible in network. Ex: Deploy ASA/App, Opt-In, Transfers, Delete, Destroy etc. `executeTransaction` takes `ExecParams` or `ExecParams[]` as parameter.
If you pass an array of `ExecParams`, it will be considered as `atomic transaction`.
In below sections we will demonstrate how to pass these parameters.

Note: For each parameter `type` and `sign` fields are mandatory.
  - `type`: type of transaction
  - `sign`: sign type

Examples of parameter [`ExecParams`](https://algobuilder.dev/api/algob/modules/runtime.types.html#execparams):
### [Transfer Algo using secret key](https://algobuilder.dev/api/algob/modules/runtime.types.html#algotransferparam)

```js
  {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: john,
    toAccountAddr: alice.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: fee }  }
```
- payFlags: [TxParams](https://algobuilder.dev/api/algob/interfaces/runtime.types.txparams.html)

### [Transfer Algo using logic signature](https://algobuilder.dev/api/algob/modules/runtime.types.html#algotransferparam)

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

### [Deploy ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#deployasaparam)

```js
  {
    type: TransactionType.DeployASA,
    sign: SignType.SecretKey,
    fromAccount: john,
    asaName: 'gold',
    payFlags: { totalFee: fee }
  }
```

### [Opt-In to ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#optinasaparam)

```js
  {
    type: TransactionType.OptInASA,
    sign: SignType.SecretKey,
    fromAccount: alice,
    assetID: assetIndex,
    payFlags: { totalFee: fee }
  }
```

### [Transfer Asset](https://algobuilder.dev/api/algob/modules/runtime.types.html#assettransferparam)

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

### [Deploy App](https://algobuilder.dev/api/algob/modules/runtime.types.html#deployappparam)

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

### [Opt-In to App](https://algobuilder.dev/api/algob/modules/runtime.types.html#optintoappparam)

```js
  {
    type: TransactionType.OptInToApp,
    sign: SignType.SecretKey,
    fromAccount: alice,
    appID: appID,
    payFlags: { totalFee: fee }
  }
```

### [Call App](https://algobuilder.dev/api/algob/modules/runtime.types.html#appcallsparam)

```js
  {
    type: TransactionType.CallNoOpApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appId: 0,
    payFlags: { totalFee: fee }
  }
```

### [Update App](https://algobuilder.dev/api/algob/modules/runtime.types.html#updateappparam)

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

### [Delete App](https://algobuilder.dev/api/algob/modules/runtime.types.html#appcallsparam)

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
Supports pooled fees where one transaction can pay the fees of other transactions within an atomic group. For atomic transactions, the protocol sums the number of transactions and calculates the total amount of required fees, then calculates the amount of fees submitted by all transactions. If the collected fees are greater than or equal to the required amount, the transaction fee requirement will be met.
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

Even though fee paid by alice is `0`, this transaction will pass because total fees collected is greater then minimum required