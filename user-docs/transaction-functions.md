# Transaction Functions available in `algob`

## `getSuggestedParams`

This function performs the task of fetching the common transaction params from the connected network blockchain. Private chains might throw some error while executing this function, please make sure that the node progresses in that case. 

This function accepts:
+ `algoc1`: an instance(object) of `Algodv2` class of `algosdk`, which is to be used to fetch the transaction params from the connected network. 

This function returns:
+ a promise on resolving which we get the desired transaction params.

The implementation can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L8).

For more information on Transaction Params, visit [this](https://developer.algorand.org/docs/reference/transactions/).

## `mkTxParams`

This function performs the trivial task of auto-generating the transaction params to be used by the user in creating the transaction object. This basically combines the custom params defined and provided by the user and the suggested params of the blockchain network and returns the combined params in a format which can be easily accepted by the blockchain network. 

This function accepts:
+ `algoc1`: an instance(object) of `Algodv2` class of `algosdk`
+ `userParams`: a dict containing custom params defined by the user
+ `s`: an optional argument which is basically `suggestedParams`, in case this argument isn't provided the function auto-generates the suggested params using the function `getSuggestedParams`.

This function returns:
+ a promise on resolving which we get the desired transaction params.


the implementation can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L20).

## `makeAssetCreateTxn`

This function is to be used when the user is trying to perform an asset create transaction. 

This function accepts:
+ `name`: the name to be used for asset
+ `asadef`: this is an extension of `ASAdef` which can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/src/types-input.ts#L9) to accept the custom params to be used while creating the asset
+ `flags`: these are the basic transaction flags, `feePerByte`, `totalFee`, etc, these can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/runtime/src/types.ts#L181).
+ `txSuggestedParams` the common params for the transaction.

This funtion returns:
+ a transaction object obtained after combining all the arguments passed during function call.

The implementation of the function can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L50).

For more detailed info about asset transaction params, visit [this](https://developer.algorand.org/docs/reference/transactions/#asset-parameters).

## `makeASAOptInTx`

This function is to be used when the user is trying to perform an asset opt-in operation.

This function accepts:
+ `addr`: the address of the user to be opted-in 
+ `assetID`: the unique asset ID for which the opt-in transaction will be performed
+ `params`: the common params for the transaction

This function returns: 
+ a transaction object obtained after combining all the arguments passed during function call.

The implementation can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L68).

## `signTransaction`

This function performs the crucial task of signing the transaction, this is a must operation while performing any kind of transaction.

This function accepts:
+ `txn`: a transaction object which is to be signed
+ `execParams`: this interface accepts all the types of params which differ while performing different types of transactions. This param is required to generalize the function to use `SecretKey` signature as well as `Logic` signature, depending on the value of the key `execParams.sign`.

This function returns:
+ a `Uint8Array` which is basically the `blob` part of the signed transaction, as only this will be required to send the transaction to the network.

The implementation can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L93).

## `sendAndWait`

This function performs the main task of sending the transaction blob to the blockchain network as well as wait for it to be confirmed in some future round.

This function accepts:
+ `deployer`: an instance of `Deployer` class
+ `execParams`: the generalized transaction params to execute every type of transaction

This function returns:
+ A promise upon resolving which we get the info of the transaction after it has been confirmed in some round of the blockchain network.

The implementation can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L116).

## `executeTransaction`

This function provides the user the ultimate power of all the above mentioned functions to perform any kind of transaction.

This function accepts:
+ `deployer`: an instance of `Deployer` class
+ `execParams`: an array or a single instance of the generalized params to execute every type of transaction 

This function sequentially performs following tasks:
+ fetch `suggestedParams`
+ make transaction params
+ create transaction params for all the transaction params in `execParams`
+ check whether the desired operation is a group transaction or a single transaction and accordingly sign the transactions
+ send the transaction object(s) to the blockchain network
+ wait for the confirmation of the transaction(s).

This function returns:
+ A promise upon resolving which we get the info of the transaction after it has been confirmed in some round of the blockchain network.

The implementation can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L128).

## `executeSignedTxnFromFile`

This function decodes a signed transaction from a file and sends it to the blockchain network. It is advised not to use this function as it has high probability of failing to perform the desired operation as every transaction contains some dynamic fields like `firstValid` and `lastValid` which may not correspond to the current network's blockchain block height.

This function accepts:
+ `deployer`: an instance of `Deployer` class
+ `fileName`: the name of the file containing the raw signed transaction, `.tx` file.

This function returns:
+ A promise upon resolving which we get the info of the transaction after it has been confirmed in some round of the blockchain network.

The implementation can be found [here](https://github.com/scale-it/algo-builder/blob/master/packages/algob/src/lib/tx.ts#L166).