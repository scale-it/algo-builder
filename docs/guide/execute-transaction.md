---
layout: splash
---

# Execute Transaction

`executeTransaction` is a high level function which can be used to perform transactions on Algorand Network. It supports every transaction (atomic or single) which is possible in network. Ex: Deploy ASA/SSC, Opt-In, Transfers, Delete, Destroy etc. `executeTransaction` takes `ExecParams` or `ExecParams[]` as parameter.
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
    payFlags: { totalFee: 1000 }
  }
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
    payFlags: { totalFee: 1000 }
  }
```

### [Deploy ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#deployasaparam)

```js
  {
    type: TransactionType.DeployASA,
    sign: SignType.SecretKey,
    fromAccount: john,
    asaName: 'gold',
    payFlags: { totalFee: 1000 }
  }
```

### [Opt-In to ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#optinasaparam)

```js
  {
    type: TransactionType.OptInASA,
    sign: SignType.SecretKey,
    fromAccount: alice,
    assetID: assetIndex,
    payFlags: { totalFee: 1000 }
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
    payFlags: { totalFee: 1000 }
  }
```

### [Deploy SSC](https://algobuilder.dev/api/algob/modules/runtime.types.html#deployappparam)

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

### [Opt-In to SSC](https://algobuilder.dev/api/algob/modules/runtime.types.html#optintoappparam)

```js
  {
    type: TransactionType.OptInToApp,
    sign: SignType.SecretKey,
    fromAccount: alice,
    appID: appID,
    payFlags: { totalFee: 1000 }
  }
```

### [Call SSC](https://algobuilder.dev/api/algob/modules/runtime.types.html#appcallsparam)

```js
  {
    type: TransactionType.CallNoOpSSC,
    sign: SignType.SecretKey,
    fromAccount: john,
    appId: 0,
    payFlags: { totalFee: fee }
  }
```

### [Update SSC](https://algobuilder.dev/api/algob/modules/runtime.types.html#updateappparam)

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

### [Delete SSC](https://algobuilder.dev/api/algob/modules/runtime.types.html#appcallsparam)

```js
  {
    type: TransactionType.DeleteApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appId: 10,
    payFlags: { totalFee: 1000 },
    appArgs: []
  }
```
