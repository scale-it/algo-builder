# Trampoline
Note: This is a demo application, please don't use it in production. Thanks
Fund app address during create

Simple example to demonstrate the use of an existing application to dynamically create a transaction to pay an account who's address is unknown at transaction signing time.

This is especially useful in the case that an application creator wants to create an application and fund it within a single (grouped) transaction.

## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.
This example is using TEAL, so make sure to follow the Python3 setup described above.

## Run

```
yarn run algob deploy
yarn run algob run scripts/run/create-fund-app.js
```
