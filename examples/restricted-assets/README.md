# Asset Transfer using custom logic

This example demonstrates authorizing asset transfer transactions based on custom logic by smart contract.

## Overview

Using Algorand Standard Assets, developers can create a token that represents either a real world or digital good, service, or resource in a matter of minutes. No smart contract is required. These assets are very powerful and allow for flexibility in how they are traded and controlled. Typically assets are traded as any other token on the chain using `asset transfer transaction`.

This is fine for most cases, but what if you want some custom logic to execute to approve the transfer? This may be the case when you have one of the following scenarios:

- KYC/AML - The user’s identity must be verified before the transaction is approved
- Extra Fees Required - Such as taxes, commission on real estate, or some basis point fee must be paid.

This solution explains the process of how this can be done in Algorand using a Smart Contract Application.

## Solution

Algorand’s Atomic Transaction feature allows multiple transactions to be submitted at once with a guarantee that either all of them will succeed or none (if one transaction fail, all transaction group is rolled back). So, one way of solving this issue is to group an asset transfer transaction with a call to a stateful smart contract and submit them simultaneously. The only limitation to this is that nothing prevents the asset transfer transaction being submitted by itself.

This example uses a stateful smart contract that uses a _user level_ approach. An app global level is an integer and represents the required level a user must have to transfer a specific asset. Users who opt into a stateful smart contract have their level stored in their local storage. So for a given asset we store globally, the required level to transfer the asset and for each user we store locally, their current level for that asset.

To implement this solution, three basic operations are required in the stateful smart contract.
- The first operation, `set-level`, is only executable by the stateful smart contract creator and it allows setting the level for a specific asset for a given user.
- The second operation, `clear-level`, is only executable by the stateful smart contract creator as well and it allows clearing the level for a specific user.
- The final operation, `check-level`, is a call that checks if an asset transfer is ok. This operation can be called by anyone wishing to transfer an asset. This operation verifies both the asset sender and receiver levels are higher than or equal the required level for the asset.

*NOTE:* User is only able to transfer asset from X to Y iff level of X & Y is greater than or equal to the minimum required level (which can by set by using the `set-level` tx). Otherwise, in case of a simple asset transfer from A to B the transaction will be rejected. For furthur information about this approach, please refer to [this](https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/) article.

### Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config. Then we can deploy the asset and smart contracts.

```
yarn run algob deploy
```

### Run
```
yarn run algob run scripts/transfer/set-clear-level.js // set minimum level(to transfer asset)
yarn run algob run scripts/transfer/transfer-asset.js // transfer asset from Alice -> Bob
```

### More information


+ Article published on this solution: [https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/](https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/)
+ Smart contracts source: [https://github.com/algorand/smart-contracts/tree/master/devrel/poi](https://github.com/algorand/smart-contracts/tree/master/devrel/poi)
+ Video: [https://www.youtube.com/watch?v=aMDZamxtR14](https://www.youtube.com/watch?v=aMDZamxtR14)
