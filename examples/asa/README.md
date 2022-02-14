# ASA deployment using [Algo Builder](https://github.com/scale-it/algo-builder/)

This project shows how to create Algorand Standard Asset (ASA).
We will create gold and tesla assets. In algob, we recommend to
create assets using a specification file, as provided in `assets/asa.yaml`.

Each of these assets are owned by their specific owner accounts.
After the creation, a third account is opted-in in order to receive the assets.

Transfers can be executed by executing `algob run scripts/transfer/gold-to-john.js` and other scripts in `scripts/transfer/`.
These scripts contain logic to transfer assets to `john-account` but other accounts can be configured as well.

Balances can be queried by executing `algob run scripts/query/john-balances.js`.

This example also includes smart signatures in (`assets/` directory) that showcase the two different modes of operation (contract & signature delegation):
- [`2-gold-contract-asc.teal`](https://github.com/scale-it/algo-builder/blob/master/examples/asa/assets/teal/2-gold-contract-asc.teal): A lsig in contract mode which approves the transaction if:
    - Transaction type is pay or axfer
    - Algo amount AND asset amount is <= 100.
- [`3-gold-delegated-asc.teal`](https://github.com/scale-it/algo-builder/blob/master/examples/asa/assets/teal/3-gold-delegated-asc.teal): A delegated lsig which approves the transaction if:
    - Transaction type is pay,
    - Amount is <= 100.
- [`4-gold-asa.teal`](https://github.com/scale-it/algo-builder/blob/master/examples/asa/assets/teal/4-gold-asa.teal): A lsig which approves the transaction if:
    - Transaction type is OPT-IN OR Transaction type is asset transfer
    - Sender is `goldOwnerAccount` 
    - Asset transfer amount is less than equal to 1000 )).
- [`5-contract-asa-stateless.py`](https://github.com/scale-it/algo-builder/blob/master/examples/asa/assets/pyteal/5-contract-asa-stateless.py): This program is stateless part of contract owned asa, ASA owned is associated with this contract address. Commands:
    - Creation: Stateful program is always called
    - Payment: Stateful program is always called, Payment type is AssetTransfer,
               Amount is <= 100 and fee is <= 10000

This example also includes a stateful contract which is a stateful part of contract owned ASA:
- [`5-contract-asa-stateful`](https://github.com/scale-it/algo-builder/blob/master/examples/asa/assets/pyteal/5-contract-asa-stateful.py):
    - Maximum number of ASA creation limit is 1.
    - Transaction must be signed by owner to get ASA out from contract
    - Only owner can call - update smart contract to set a new owner
    - Only owner can transfer ASA out from the smart contract and maximum payment is 100 ASA.

## Usage

Please follow the [setup](../README.md) instructions to install dependencies and update the config.
This example is using PyTEAL, so make sure to follow the Python3 setup described above.

### Run
```
yarn algob deploy
yarn algob run scripts/query/john-balances.js
```
