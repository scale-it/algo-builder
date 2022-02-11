---
layout: splash
---

# Rekeying transaction

- You should read about Algorand rekeying, [here](https://developer.algorand.org/docs/get-details/accounts/rekey/). 
- `Runtime` supported a rekeying transaction. You can use field `rekeyTo` in `payFlags` to rekey from account to another address. 
- We can rekeying:
    - Account to any account.
    - Logic account to any account.
    - Application to any account. We use inner transaction to rekey application.

Example: 

- We can rekey join account to bob follow below config.
```js
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: john,
    toAccountAddr: alice.address,
    amountMicroAlgos: 0n,
    payFlags: { 
        totalFee: fee 
        rekeyTo: bob.address
    } 
```

- We can rekey logic signature (lsig) to bob.

```js
{
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.LogicSignature,
    lsig: lsig,
    toAccountAddr: bob.address,
    amountMicroAlgos: 0n,
    payFlags: {
        totalFee: fee 
        rekeyTo: bob.address 
    }
}
```

You can check how to use rekeying transaction at  [here](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/rekey-transaction.ts).