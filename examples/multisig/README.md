# Multisignature delegated account support

Examples to demonstrate authorizing transactions based on logic signature signed by multiple accounts.

Two examples are provided
1. `multisig_goal_sc.js` - Loading a multi signed logic signature file (gold-john-bob.mlsig) from `/assets` and using that lsig for validating transactions.
2. `multisig_sdk_sc.js` - Compiling a smart-contract code and from `/assets`, load it, sign it and use in transactions.   


## Usage

This example uses a multisig logic. Creating a multisig is an interactive process and currently `algob` only supports loading a multisig.
To follow this example you have to firstly create a multisig.

### Creating multisig file

You can use goal to create multisig accounts, compile a TEAL program and sign it with an address. This will create a logic signature file which `algob` can load from `/assets` and use in transactions. Example commands are provided below.

Creating a multisig account (threshold: 2)
```bash
goal account multisig new -T 2 addr1 addr2 addr3 -d ~/<data_diretory>
```
Compile TEAL Code and sign it with addr1
```bash
goal clerk multisig signprogram -p <path>/sample.teal -a addr1 -A <multisig_hash> -o <out_path>/signed.mlsig -d <data_directory>
``` 
Sign again with addr2 (as threshold is set to 2)
```bash
goal clerk multisig signprogram -L <path>/signed.mlsig -a addr2 -A <multisig_hash> -d ~/<data_directory>
```

Disassembling the signed multisig binary 
```bash
goal clerk compile -D <path>/signed.mlsig
```
Paste the above output in `examples/multisig/assets/<file_name>.mlisg`

You need to ***save the signed logic signature file in `examples/multisig/assets` directory***. The file must have ***.mlsig*** extension.

### Setup

We need to link algob as the package dependency.

    yarn install
    yarn link algob


### Update config

Open `algob.config.js` and update:

+ Update `master-account`. It must be an account with some ALGOs - it will be used for deployment and for activating / funding other accounts.

### Run
```
yarn run algob run scripts/multisig_goal_sc.js
yarn run algob run scripts/multisig_sdk_sc.js
```
Read the Docs - https://developer.algorand.org/docs/features/asc1/goal_teal_walkthrough/#creating-a-multi-signature-delegated-logic-sig