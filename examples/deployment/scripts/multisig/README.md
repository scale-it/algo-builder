# Multisignature delegated account support

This folder contains examples to demonstrate authorizing transactions based on logic signature signed by multiple accounts.

Two examples are provided
1. `multisig_goal_sc.js` - Loading a multi signed logic signature file (gold-john-bob.mlsig) from assets/ and using that lsig for validating transactions.
2. `multisig_sdk_sc.js` - Compiling a smart-contract code and from assets/,loading it, signing it and using in transactions.   


## Usage

```bash
# examples/deployment
yarn run algob run scripts/multisig/multisig_goal_sc.js #uses .mlsig from assets
yarn run algob run scripts/multisig/multisig_sdk_sc.js
```

## Creating multisig file

You can use goal to create multisig accounts, compile a TEAL program and sign it with an address. This will create a logic signature file which algob can load from assets/ and use in transactions). Example commands are provided below.

Creating a multisig account (threshold: 2)
```bash
goal account multisig new -T 2 addr1 addr2 addr3 -d ~/<data_diretory>
```
Compile TEAL Code and sign it with addr1
```bash
goal clerk multisig signprogram -p <path>/sample.teal -a addr1 -A <multisig_hash> -o <out_path>/signed.mlsig -d <data_directory>
``` 
Sign again with addr2
```bash
goal clerk multisig signprogram -L <path>/sample.teal -a addr2 -A <multisig_hash> -d ~/<data_directory>
```

You need to ***save the signed logic signature file in examples/deployment/assets/ directory***. The file must have ***.mlsig*** extension.

Read the Docs - https://developer.algorand.org/docs/features/asc1/goal_teal_walkthrough/#creating-a-multi-signature-delegated-logic-sig