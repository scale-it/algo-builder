---
layout: splash
---

# Execute Transaction

`executeTransaction` function can be used to perform many transactions. It supports every transaction which is possible in algorand network. Ex: Deploy ASA/SSC, Opt-In, Transfers, Delete, Destroy etc. `executeTransaction` takes `ExecParams` or `ExecParams[]` as parameter.
If you pass an array of `ExecParams`, it will be considered as `atomic transaction`.
In below sections we will demonstrate how to pass these parameters.

Note: For each parameter `type` and `sign` fields are mandatory.
  - `type`: type of transaction
  - `sign`: sign type

Examples of parameter(`ExecParams`):
# Transfer Algo using secret key

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

# Transfer Algo using logic signature

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

# Deploy ASA

```js
  {
    type: TransactionType.DeployASA,
    sign: SignType.SecretKey,
    fromAccount: john,
    asaName: 'gold',
    payFlags: { totalFee: 1000 }
  }
```

# Opt-In to ASA

```js
  {
    type: TransactionType.OptInASA,
    sign: SignType.SecretKey,
    fromAccount: alice,
    assetID: assetIndex,
    payFlags: { totalFee: 1000 }
  }
```

# Transfer Asset

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

# Deploy SSC

```js
  {
    type: TransactionType.DeploySSC,
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

# Opt-In to SSC

```js
  {
    type: TransactionType.OptInSSC,
    sign: SignType.SecretKey,
    fromAccount: alice,
    appID: appID,
    payFlags: { totalFee: 1000 }
  }
```

# Update SSC

```js
  {
    type: TransactionType.UpdateSSC,
    sign: SignType.SecretKey,
    fromAccount: john,
    appID: appId,
    newApprovalProgram: newApprovalProgram,
    newClearProgram: newClearProgram,
    payFlags: {}
  }
```

# Delete SSC

```js
  {
    type: TransactionType.DeleteSSC,
    sign: SignType.SecretKey,
    fromAccount: john.account,
    appId: 10,
    payFlags: { totalFee: 1000 },
    appArgs: []
  }
```