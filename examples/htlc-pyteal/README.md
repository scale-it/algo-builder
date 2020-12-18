# Hash-Time-Lock-Contract Example using PyTeal

In this example, Bob creates an escrow account protected by a hash time lock contract:
+ Alice can withdraw funds from the account only if she will get a secret
+ to avoid locking up the funds forever, Bob can get back the funds after a specified deadline.
A secret can represent a puzzle solution, or a coupon unveiled when Bob makes an action (eg receives assets or real world goods).

Read [here](https://en.bitcoin.it/wiki/Hash_Time_Locked_Contracts) for more information about the HTLC pattern.

Files:

* `htlc.py` : It is the HTLC. SHA256 function is used for hashing. <br />
        secret value : `hero wisdom green split loop element vote belt` hashed with sha256 will produce `QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=`  which is used in this code.
* `deploy.js` : It is used to create and fund HTLC contract account which is defined in `assets/htlc.py`.
* `htlc-withdraw.js` : It is used to show transactions between contract and a user.


## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.
This example is using PyTEAL, so make sure to follow the Python3 setup described above.

## Run

```
    yarn run algob deploy
    yarn run algob run scripts/withdraw/htlc-withdraw.js
```
