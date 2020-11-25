# Hash-Time-Lock-Contract Example using PyTeal

In this example, the buyer funds a TEAL account with the sale price.
The buyer also picks a secret value and encodes a secure hash of this value in
the TEAL program. The TEAL program will transfer its balance to the seller
if the seller is able to provide the secret value that corresponds to the hash in the program.

* `htlc.py` : It is the HTLC. SHA256 function is used for hashing. <br />
        secret value : `hero wisdom green split loop element vote belt` hashed with sha256 will produce our image hash `QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=`  which is used in this code.
* `fund-pyteal.js` : It is used to fund HTLC which is present in `assets` as `htlc.py`.
* `htlc-example.js` : It is used to show transactions between contract and seller.


## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.
This example is using PyTEAL, so make sure to follow the Python3 setup described above.

## Run

```
    yarn run algob deploy
    yarn run algob run scripts/transfer/htlc-example.js
```
