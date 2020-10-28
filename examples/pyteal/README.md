# Hash-Time-Lock-Contract Example using PyTeal

In this scheme, the buyer funds a TEAL account with the sale price. 
The buyer also picks a secret value and encodes a secure hash of this value in 
the TEAL program. The TEAL program will transfer its balance to the seller 
if the seller is able to provide the secret value that corresponds to the hash in the program.

* `htlc.py` : It is the HTLC. SHA256 function is used for hashing. <br />
        secret value : `hero wisdom green split loop element vote belt` hashed with sha256 will produce our image hash `QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=`  which is used in this code.
* `fund-pyteal.js` : It is used to fund HTLC which is present in `assets` as `htlc.py`.
* `htlc-example.js` : It is used to show transactions between contract and seller.

## Setup

* Install `pyteal` using `pip3 install pyteal` https://pyteal.readthedocs.io/en/stable/installation.html
```
    yarn install
    yarn link algob
```

## Update config

Open `algob.config.js` and update:

+ Update `master-account`. It must be an account with some ALGOs - it will be used for deployment and for activating / funding other accounts.

## Run

```
    yarn run algob deploy
    yarn run algob run scripts/transfer/htlc-example.js
```