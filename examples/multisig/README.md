# Multisignature delegated account support

This example demonstrates authorizing transactions based on logic signature signed by multiple accounts.

## Description

Transactions on a blockchain via asc1 (Algorand Smart Contract) logic can be done in two modes: `contract mode` and `delegated approval` mode. In `delegated approval` mode an account owner can declare on their behalf that the signed logic can authorize transactions. These accounts can be either single or multi-signature accounts. The purpose of this example is to support ASC1 transactions authorized by `multi-signature` accounts.

Let's say `john`, `bob` and `gold` create a multisignature account with threshold 2 and want to send some algos according to a smart contract logic (`sample-asc.teal`). To do so, one of the three users (say `john`) compiles the `sample-asc.teal` file and signs it. This creates a signed logic signature file (`gold-john-bob.lsig`) which must be signed atleast one more time as threshold is set to 2. The current user (say `john`) passes this file to `bob` and he signs it again. Now this file can be successfully used to validate transactions. `algob` provides the functionality to load and use a multi-signed logic for transactions. Commands to create multisig account and signing logic with account addresses are provided below.

You can find the example code in `/scripts`
1. `/multisig_goal_sc.js` - Loading a multi signed logic (either `raw` or `disassembled`) from a file (`/assets/sample-text-asc.lsig` or `sample-raw-asc.blsig`) and using that lsig for validating transactions.
2. `/multisig_sdk_sc.js` - Compile a smart-contract code from `/assets/sample-asc.teal`, load it, sign it and use in transactions.   


## Usage

This example uses a multisig logic. Creating a multisig is an interactive process and currently `algob` only supports loading a multisig.
To follow this example you have to firstly create a multisig.


### Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.


### Creating multisig file

You can use goal to create multisig accounts, compile a TEAL program and sign it with an address. This will create a logic signature file which `algob` can load from `/assets` and use in transactions. Example commands are provided below.

Creating a multisig account (threshold: 2)
```bash
goal account multisig new -T 2 addr1 addr2 addr3 -d ~/<data_diretory>
```
Compile TEAL Code and sign it with addr1
```bash
goal clerk multisig signprogram -p <path>/sample.teal -a addr1 -A <multisig_hash> -o <out_path>/signed.lsig -d <data_directory>
```
Sign again with addr2 (as threshold is set to 2)
```bash
goal clerk multisig signprogram -L <path>/signed.lsig -a addr2 -A <multisig_hash> -d ~/<data_directory>
```

The logic sig file generated using the commands above is a binary file. To use it, you have to store it in the `/assets` directory with `.blsig` extension (binary encoded LogicSig). You can also decompile it to a readable format (command provided below) and save it to `/assets` with `.lsig` extension.

 To disassemble the signed multisig binary
```bash
goal clerk compile -D <path>/signed.lsig
```
Paste the above output in `examples/multisig/assets/<file_name>.lsig`

You need to ***save the signed logic signature file in `examples/multisig/assets` directory***. The file must have ***.lsig*** or ***.blsig*** extension depending on the type of file (text/binary).


### Run
```
yarn run algob run scripts/multisig_goal_sc.js
yarn run algob run scripts/multisig_sdk_sc.js
```

### More information


+ https://developer.algorand.org/docs/features/asc1/goal_teal_walkthrough/#creating-a-multi-signature-delegated-logic-sig
+ Modes of Use: https://developer.algorand.org/docs/features/asc1/stateless/modes/
