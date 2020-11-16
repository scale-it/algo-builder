# Non-Fungible-Token Example using StateFul Teal

In this example, we create a new non-fungible-token represented by a name and a url.
`algob` provides two functions :-
* `createNewNFT` - creates a new Non Fungible Token. Only the smart contract admin can create a new NFT.
* `transferNFT` - transfer an NFT from one account to another. Both account should have opted-in to the smart contract and the account wishing to transfer the NFT must hold the NFT (in the account's local state).

Also to be noted
* An account can hold upto a maximum of 16 NFT's in it's local storage.
* The system can hold a maximum of 63 NFT's (in global storage)

## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.

## Run

```
    yarn run algob deploy
    yarn run algob run scripts/transfer/create-transfer-nft.js
```