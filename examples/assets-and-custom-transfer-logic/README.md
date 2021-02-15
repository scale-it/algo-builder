# Multisignature delegated account support

This example demonstrates authorizing asset transfer transactions based on custom logic by smart contract.

## Overview

Using Algorand’s native layer one Assets, developers can create a token that represents either a real world or digital good, service, or resource in a matter of minutes. No smart contract is required. These assets are very powerful and allow for flexibility in how they are traded and controlled. Typically assets are traded as any other token on the chain. All that is required is to issue an `asset transfer transaction`.

This is fine for most cases, but what if you want some custom logic to execute to approve the transfer. This may be the case when you have one of the following scenarios.

- KYC/AML - The user’s identity must be verified before the transaction is approved
- Extra Fees Required - Such as taxes, commission on real estate, or some basis point fee must be paid.

This solution explains the process of how this can be done in Algorand using a Smart Contract Application.

## Problem Solution

Using Algorand’s Atomic Transaction feature allows multiple transactions to be submitted at one time and if any of the transactions fail, then they all fail. So, one way of solving this issue is to group an asset transfer transaction with a call to a stateful smart contract and submit them simultaneously. The only limitation to this is that nothing prevents the asset transfer transaction being submitted by itself.

This example uses a stateful smart contract that uses a level system. The level is a simple integer and represents the required level a user must have to transfer a specific asset. Users who opt into the stateful smart contract have their level stored in local storage. So for a given asset we store globally, the required level to transfer the asset and for each user we store locally, their current level for the asset.

To implement this solution, three basic operations are required to be implemented in the stateful smart contract. The first operation is only executable by the stateful smart contract creator and it allows setting the level for a specific asset for a given user. The second operation is only executable by the stateful smart contract creator as well and it allows clearing the level for a specific user. The final operation is a call that checks if an asset transfer is ok. This operation can be called by anyone wishing to transfer an asset. This operation verifies both the asset sender and receiver levels are higher than or equal the required level for the asset.


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


+ [https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/](https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/)
