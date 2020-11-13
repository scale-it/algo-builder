# Smart Contract Templates

The goal of this project is to present how to work with ASC in `algob` using the best practices and templates using the Algorand reference templates:

+ [dynamic Fee](https://developer.algorand.org/docs/reference/teal/templates/dynamic_fee/) - using PyTEAL
+ [hash time lock contract](https://developer.algorand.org/docs/reference/teal/templates/htlc/) - using PyTEAL. For more advanced example using HTLC with PyTEAL please check our [htlc-pyteal](../htlc-pyteal) example.
+ [limit order](https://developer.algorand.org/docs/reference/teal/templates/limit_ordera/) - we ported the code to PyTEAL.

## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.

* Install `pyteal` using `pip3 install pyteal` https://pyteal.readthedocs.io/en/stable/installation.html

## Run

To run hash time lock contract or dynamic Fee use the deploy command:

        yarn run algob deploy