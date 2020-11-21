# Non-Fungible-Token Example using StateFul Teal

In this example, we create a new non-fungible-token represented by a name and a ref.
Compared to standard ASA, in this example we create a smart-contract to manage and store NFT balances. 

- each NFT is an `(ID, ref_data, hash)` triple, Stored in the smart contract with the mapping of `{id: ref_data, id_h: hash}`
- `id` is the NFT ID which is calculated as - (total count of nft in asc + 1). Eg. `nft_id = 1` for the first nft in the smart contract.
- `ref_data` is represented by encoding nft details passed to smart contract. Eg. `name: "nft-1"`, `ref: some-ref` is passed to asc, then `ref_data` = `https://nft-1.com/<nft_id>/some-ref`.
- `id_h` is a `Sha256` hash of  `ref`.

Please check smart contract for the available commands and passing arguments to the smart contract.

Also to be noted
* An account can hold upto a maximum of 8 NFT's in it's local storage.
* The NFT smart contract can hold a maximum of 32 NFT's (in global storage)
* _**This is only a proof of concept**. In production use we need to handle properly the account which can manage the smart-contract (update or delete)_. 
* In this ASC, Update Application call is **blocked** i.e once deployed, you cannot update the smart contract by another program. Refer to [this](https://developer.algorand.org/docs/features/asc1/stateful/#update-stateful-smart-contract) for more details. 

This is because the ASC can store a maximum of 16 values (`int/[]byte`) in local storage and 64 values (`int/[]byte`)  in the global storage. Read more about state storage [here](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#state-storage).

## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.

## Run

```
yarn run algob deploy
yarn run algob run scripts/transfer/create-transfer-nft.js
```