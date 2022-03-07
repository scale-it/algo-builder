---
layout: splash
---

# Rekeying transaction

- Read first about [Algorand rekeying](https://developer.algorand.org/docs/get-details/accounts/rekey/).
  `Runtime` supports a rekey transaction. You can use field `rekeyTo` in `payFlags` to rekey:
- Account to any account.
- Smart Signature account to any account.
- Application to any account. We use inner transaction to rekey application.

Example:

We can rekey John account to Bob using the following transaction params.

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

- We can rekey smart signature (lsig) to Bob.

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

You can check how to use rekeying transaction in the [source code](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/test/integration/rekey/rekey-transaction.ts).
