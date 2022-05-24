# Inner-tx-create-assets 

**Note: This is a demo application, please don't use it in production. Thanks**

Demo use case for `Txn.created_asset_id()` and `Txn.created_application_id()`.

## Deploy smart contract 

```bash 
yarn run algob deploy
```


## Deploy new application, asset and log id by group transaction

```
yarn run algob run useGroupTxn.js
```

## Deploy new application, asset and log id by inner transaction 

```
yarn run algob run useInnerTxn.js
```
