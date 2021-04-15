# Executing a serialized transaction

This example demonstrates executing a serialized transaction loaded directly from a file. A user can create a transaction and sign it (using `goal`) and send it to someone else to execute it. Instructions to create a serialized transaction using `goal` is provided below.

**NOTE**: This will probably not work because transaction contains fields like `firstValid` and `lastValid` which will be different for different network configurations.


### Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.


### Creating serialized transaction file

You can use `goal` to create a transaction and sign it.

Creating a transaction and writing to file `out.txn`
```bash
goal clerk send -a <amount> -f <from_account> -t <to_account> -o out.txn -d ~/<data_directory>
```
Sign transaction (signed by `<from_account>`)
```bash
goal clerk sign -i [input file] -o [output file] -d ~/<data_directory>
```

You need to ***save the signed transaction file in `examples/multisig/assets` directory***.
The standard transaction file extension is `.txn`, but the code accepts any extension. The only constraint is that the file should have a valid signed encoded transaction object.

### Run
```
yarn run algob run scripts/transfer.js
```

### More information


+ [https://developer.algorand.org/docs/reference/cli/goal/clerk/send/]()
+ [https://developer.algorand.org/docs/reference/cli/goal/clerk/sign/]()
