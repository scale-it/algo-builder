# Non-Fungible-Token Example using stateful TEAL

In this example, we create a new non-fungible-token represented by a name and a ref.
Compared to standard ASA, in this example we create a smart-contract to manage and store NFT balances.

- Each NFT is an `(ID, data_ref, hash)` triple, stored in the smart contract as `{id: data_ref, id_h: hash}` mapping.
- `id` is the NFT ID which is calculated as: `total_count_of_nft + 1`. Eg: `id = 1` for the first nft in the smart contract.
- `data_ref` is associated reference data. Ideally the `data_ref` should be an external URL. Eg: `data_ref` = `https://nft.com/1/ref`.
- `hash` is a hash of the content of referenced data (eg: content of the data at the URL).

Please check smart contract for the available commands and arguments to the smart contract.

NOTES:
* A smart contract can create up to 32 NFTs and an account can hold up to 16 NFT's in it's local storage. This is because the ASC can store a maximum of 16 values (`int`) in user account local storage and 64 values (`int/[]byte`)  in the global storage. Read more about state storage [here](https://developer.algorand.org/docs/features/asc1/stateful/sdks/#state-storage).
* _**This is only a proof of concept**. In production use we need to handle properly the account which can manage the smart-contract (update or delete)_ and audit all conditions.
* In this ASC, Update Application call is **blocked** i.e once deployed, you cannot update the smart contract by another program. Refer to [this](https://developer.algorand.org/docs/features/asc1/stateful/#update-stateful-smart-contract) for more details.


## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.
This example is using PyTEAL, so make sure to follow the Python3 setup described above.

## Run

```
yarn run algob deploy
yarn run algob run scripts/transfer/create-transfer-nft.js
```
