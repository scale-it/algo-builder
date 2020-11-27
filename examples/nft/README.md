# Non-Fungible-Token Example using stateful TEAL

In this example, we create a new non-fungible-token represented by a name and a ref.
Compared to standard ASA, in this example we create a smart-contract to manage and store NFT balances.

- Each NFT is an `(ID, ref_data, hash)` triple, stored in the smart contract as `{id: ref_data, id_h: hash}` mapping.
- `id` is the NFT ID which is calculated as: `total_count_of_nft + 1`. Eg: `id = 1` for the first nft in the smart contract.
- `ref_data` is associated reference data. Ideally the `ref_data` should be an external URL. Eg: `ref_data` = `https://nft.com/1/ref`.
- `id_h` is a `sha256` hash of  the content of reference data.

Please check smart contract for the available commands and arguments to the smart contract.

NOTE:
* An account can hold upto a maximum of 8 NFT's in it's local storage.
* The NFT smart contract can hold a maximum of 32 NFT's (in global storage)
* _**This is only a proof of concept**. In production use we need to handle properly the account which can manage the smart-contract (update or delete)_.
* In this ASC, Update Application call is **blocked** i.e once deployed, you cannot update the smart contract by another program. Refer to [this](https://developer.algorand.org/docs/features/asc1/stateful/#update-stateful-smart-contract) for more details.

This is because the ASC can store a maximum of 16 values (`int/[]byte`) in user account local storage and 64 values (`int/[]byte`)  in the global storage. Read more about state storage [here](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#state-storage).

## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.
This example is using PyTEAL, so make sure to follow the Python3 setup described above.

## Run

```
yarn run algob deploy
yarn run algob run scripts/transfer/create-transfer-nft.js
```
