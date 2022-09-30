---
layout: splash
---

# SignedTransaction

`Runtime` can not only work with the `ExecParams` but also with `algosdk.SignedTransaction` objects. This allow for easier interaction with `algosdk` and provides more flexibility and functionality. We can create transactions and sign them using `algosdk` methods and execute them in `Runtime`. 

## Example

The example shows how to send 5 algo from one account to another using `Runtime`, `Runtime.defaultAccounts()` which are predefined, funded accounts and `algosdk` to create and sign the transaction. For more details check the [algorand docs](https://developer.algorand.org/docs/sdks/javascript/#build-first-transaction).

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
            suggestedParams: suggestedParams,
        });
// sign it and decode it to signedTransaction object
const signedTransacion = algosdk.decodeSignedTransaction(transaction.signTxn(alice.account.sk));
// submit the transaction
const confirmedTxn = runtime.executeTx([signedTransacion]);
console.log(confirmedTxn);
```
Check the example in our [tests](../../packages/runtime/test/src/guide-examples.ts).