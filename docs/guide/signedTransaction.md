---
layout: splash
---

# SignedTransaction

`Runtime` supports transactions described as `ExecParams` and traditional `algosdk.SignedTransaction` objects. This allow for easier interaction with `algosdk` and provides more flexibility and functionality. We can create transactions and sign them using `algosdk` methods and execute them in `Runtime`. 

## Example

The example shows how to send 5 algo from one account to another using `Runtime`. We will use `Runtime.defaultAccounts()` which are predefined, funded accounts and `algosdk` to create and sign the transaction. For more details check the [algorand docs](https://developer.algorand.org/docs/sdks/javascript/#build-first-transaction).

```ts
// create runtime
const runtime = new Runtime([]);
// get two funded accounts
const [alice, bob] = runtime.defaultAccounts();
// mock suggested params
const suggestedParams = mockSuggestedParams({ totalFee: 1000 }, runtime.getRound());
// create transaction using algosdk
const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: alice.address, 
        to: bob.address, 
        amount: 5e6, //5 algo 
        note: undefined,
        suggestedParams: suggestedParams});
// sign it and decode it to signedTransaction object
const signedTransacion = algosdk.decodeSignedTransaction(transaction.signTxn(alice.account.sk));
// submit the transaction
const confirmedTxn = runtime.executeTx([signedTransacion]);
console.log(confirmedTxn);
```
Check the example in our [tests](../../packages/runtime/test/src/guide-examples.ts).

# Multisignature

Support of `SignedTransaction` objects in `Runtime` enables users to test their multisignatures. Again with the help of `algosdk` we can create multisignature address, rekey an existing runtime account to this address and then sign transactions using multisignature accounts. `Runtime` verifies the signature and if it's valid, it executes the transaction.

## Example

This example shows how to create a multisignature address using `algosdk`, rekey an existing runtime account to multisignature, create a transaction and sign it using multisignature. For more details check the [algorand docs](https://developer.algorand.org/docs/get-details/transactions/signatures/#multisignatures).

```ts
// create runtime
const runtime = new Runtime([]);
// get two funded accounts
let [alice, bob, charlie, elon] = runtime.defaultAccounts();
// mock suggested params
const suggestedParams = mockSuggestedParams({ totalFee: 1000 }, runtime.getRound());
// create multisignature parameters
const addrs = [bob.address, charlie.address];
const multiSigParams = {
    version: 1,
    threshold: 2,
    addrs: addrs};
// create multisignature address
const multSigAddr = algosdk.multisigAddress(multiSigParams);
// rekey alice to multisignature account
const txParam: types.AlgoTransferParam = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: alice.account,
    fromAccountAddr: alice.address,
    toAccountAddr: alice.address,
    amountMicroAlgos: 0,
    payFlags: {totalFee: 1000, rekeyTo: multSigAddr},
};
runtime.executeTx([txParam]);
// sync accounts
[alice, bob, charlie, elon] = runtime.defaultAccounts();
// create transaction using algosdk
const txn = algosdk.makePaymentTxnWithSuggestedParams(
    alice.account.addr, // from
    elon.account.addr, // to
    5e6, // 5 algo
    undefined,
    undefined,
    suggestedParams);
// Sign with first account
const rawSignedTxn = algosdk.signMultisigTransaction(
    txn,
    multiSigParams,
    bob.account.sk
).blob;
// Sign with second account
const twosigs = algosdk.appendSignMultisigTransaction(
    rawSignedTxn,
    multiSigParams,
    charlie.account.sk
).blob;
// decode the transaction
const signedTxn: SignedTransaction = algosdk.decodeSignedTransaction(twosigs);
// submit the transaction
const confirmedTxn = runtime.executeTx([signedTxn]);
console.log(confirmedTxn);
```

### Full Code

Check the example in our [tests](../../packages/runtime/test/src/guide-examples.ts).