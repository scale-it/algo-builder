---
layout: splash
---

# Execute Transaction

`executeTx` is a high level method of Deployer which can be used to perform transactions on Algorand Network. It supports every transaction (atomic or single) which is possible in network. Ex: Deploy ASA/App, Opt-In, Transfers, Delete, Destroy etc. `executeTx` takes `ExecParams[]` or `SignedTransaction[]` as parameter.
In below sections we will demonstrate how to pass these parameters.

Note: For each parameter `type` and `sign` attributes are mandatory.

- `type`: type of transaction
- `sign`: signature type

Depending on the transaction `type`, other attributes will specify a signer of the transaction. For example, for `TransactionType.TransferAlgo` the `fromAccount` must be a full account (with secret key) and will sign the transaction.

`deployer.executeTx` returns list of `TxnReceipt`, which extends `ConfirmedTxInfo`.

```js
const receipts = deployer.executeTx([txn0, txn1]);
console.log("txn0 information: ", receipts[0]);
console.log("txn1 information: ", receipts[2]);
```

Below we demonstrate how to perform application call using `ExecParam` and `WebMode`:

```js
appCall = () => {
		const webMode: WebMode = new WebMode(AlgoSigner, networkType);
		const tx: types.ExecParams[] = [
			{
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: {
					addr: addr,
					sk: new Uint8Array(0),
				},
				appID: 100,
				payFlags: {},
			},
		];
		webMode.executeTx(tx);
	};
```

We can also use `SignedTransaction` and `executeTx` in runtime:

```js
    const tx: Transaction = decodeSignedTransaction(rawTxns).txn;
    let signedTx: SignedTransaction = {txn: tx};
    runtime.executeTx(signedTx);
```

## ExecParams

If the length of `ExecParams` array is greater than one, it will be considered as `atomic transaction` otherwise `single transaction`.Examples of [`ExecParams`](https://algobuilder.dev/api/algob/modules/runtime.types.html#ExecParams) usage. `ExecParams` is preferred when there is a transaction which is not already signed and want to be executed.

#### [Transfer Algo using secret key](https://algobuilder.dev/api/algob/modules/runtime.types.html#AlgoTransferParam)

```js
  {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: john,
    toAccountAddr: alice.address,
    amountMicroAlgos: 100,
    payFlags: { totalFee: fee }  
  }
```

- payFlags: [TxParams](https://algobuilder.dev/api/algob/interfaces/runtime.types.TxParams.html)

#### [Transfer Algo using logic signature](https://algobuilder.dev/api/algob/modules/runtime.types.html#AlgoTransferParam)

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

#### [Deploy ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#DeployASAParam)

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

#### [Opt-In to ASA](https://algobuilder.dev/api/algob/modules/runtime.types.html#OptInASAParam)

```js
  {
    type: TransactionType.OptInASA,
    sign: SignType.SecretKey,
    fromAccount: alice,
    assetID: assetIndex,
    payFlags: { totalFee: fee }
  }
```

#### [Transfer Asset](https://algobuilder.dev/api/algob/modules/runtime.types.html#AssetTransferParam)

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

#### [Deploy App](https://algobuilder.dev/api/algob/modules/runtime.types.html#DeployAppParam)

We support 3 format of DeloyApp params:

- Deploy source from files(supported in `algob` cli and `runtime`).

```js
  {
    type: TransactionType.DeployApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appDefinition: {
      appName: "my-app",
      metaType: MetaType.FILE
      approvalProgramFilename: "approval.teal",
      clearProgramFilename: "clear.teal",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
    }
    payFlags: {}
  }
```

- Deploy source from code(supported in `algob` cli and `runtime`).

```js
  {
    type: TransactionType.DeployApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appDefinition: {
      appName: "my-app",
      metaType: MetaType.SOURCE_CODE
      approvalProgramCode: "<approval program>",
      clearProgramCode: "<clear state program>",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
    }
    payFlags: {}
  }
```

- Deploy source from compiled code(supported in `algob` cli and `web`).

```js
  {
    type: TransactionType.DeployApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appDefinition: {
      appName: "my-app",
      metaType: MetaType.BYTES
      approvalProgramBytes: "<compiled bytes from algod client>",
      clearProgramBytes: "<compiled bytes from algod client>",
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1,
    }
    payFlags: {}
  }
```

- To learn about more parameters like (account, appArgs, ForeignApps, ForeignAssets etc).Please check [AppOptionalFlags](https://algobuilder.dev/api/algob/interfaces/runtime.types.AppOptionalFlags.html)

#### [Opt-In to App](https://algobuilder.dev/api/runtime/classes/Runtime.html#optInToApp)

```js
  {
    type: TransactionType.OptInToApp,
    sign: SignType.SecretKey,
    fromAccount: alice,
    appID: appID,
    payFlags: { totalFee: fee }
  }
```

#### [Call App](https://algobuilder.dev/api/algob/modules/runtime.types.html#AppCallsParam)

```js
  {
    type: TransactionType.CallNoOpApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appId: 0,
    payFlags: { totalFee: fee }
  }
```

#### [Update App](https://algobuilder.dev/api/algob/modules/runtime.types.html#UpdateAppParam)

`newAppCode` type is `SmartContract`. Please check [types define](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/types.ts).

```js
  {
    type: TransactionType.UpdateApp,
    sign: SignType.SecretKey,
    fromAccount: john,
    appID: appId,
    appName: "my-app",
    newAppCode: {
      metaTypes: MetaType.FILE
      approvalProgramFilename: "approval.teal",
      clearProgramFileName: "clear.teal",
    },
    payFlags: {}
  }
```

#### [Delete App](https://algobuilder.dev/api/algob/modules/runtime.types.html#AppCallsParam)

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

With [AVM 0.9](https://developer.algorand.org/articles/introducing-algorand-virtual-machine-avm-09-release/) release, algob also supports pooled transaction fees.
One transaction can pay the fees of other transactions within an atomic group. For atomic transactions, the protocol sums the number of transactions and calculates the total amount of required fees, then calculates the amount of fees submitted by all transactions. If the collected fees are greater than or equal to the required amount, the transaction fee requirement will be met.
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

## Sign and Send SDK Transaction object using `executeTx` method

`deployer.executeTx` method supports signing and sending sdk transaction objects. To do this you will have to pass an [`TransactionAndSign`](https://algobuilder.dev/api/web/interfaces/types.TransactionAndSign.html) object which has following properties:

- `type`: type of transaction.
- `sign`: signature [`types`](https://github.com/scale-it/algo-builder/blob/2bcef8f611b349dfb8dc3542ed2f0a129a0c405c/packages/web/src/types.ts#L117).

Ex:

```js
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

There is also a function to check if given object implements `Transaction` class and has `Sign`.

```js
export function isSDKTransactionAndSign(object: unknown): object is TransactionAndSign {
	if (object === undefined || object === null) {
		return false;
	}
	const res = isSDKTransaction((object as TransactionAndSign).transaction);
	return Object.prototype.hasOwnProperty.call(object, "sign") && res;
}
```

### SignTransactions function

This function takes array of [`TransactionAndSign`](https://algobuilder.dev/api/web/interfaces/types.TransactionAndSign.html) objects and returns raw signed transaction. `SignedTransaction` is preferred when there is a transaction which is already signed and has to be sent to network.

```js
const transaction: wtypes.TransactionAndSign = [{
  transaction: SDKTx,
  sign: {sign: wtypes.SignType.SecretKey, fromAccount: bobAcc}
}]
const rawSign = signTransactions(transaction)
```

`rawSign` has array of raw signed transactions.
You can check the implementation in [asa](https://github.com/scale-it/algo-builder/blob/master/examples/asa/scripts/2-gold-asc.js) example.
