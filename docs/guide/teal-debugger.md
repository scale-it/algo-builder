---
layout: splash
---

# Debugging TEAL

Algorand provides the `tealdbg` command-line tool to launch an interactive session where a smart contract can be examined as the contract is being evaluated. The debugger supports both stateful and stateless smart contracts. You can debug individual transactions or group of transaction (eg atomic transfers). The debugger supports setting the specific context for debugging purposes, including transactions, round number, latest timestamp, balance records, etc. The debugger runs either local programs or accepts HTTP connections from remote evaluators configured to run with a remote debugger hook.

## Using TEAL debugger with algob

Setting up a `--dryrun-dump` of transaction data (via `goal` or SDK) could be a lengthy process, especially when using a transaction group. `Algob` provides an easy way to use debugger: by simply supplying the transactions as an input to the `TealDbg` method (same transaction parameters that we supply to [executeTransaction](https://algobuilder.dev/api/algob/modules.html#executetransaction) to execute same transaction on network).

NOTE: You use the `TealDbg` method in an algob script, which can be run using `algob deploy`/`algob run` commands.

### Using Dryrun for Debugging a TEAL Program in an algob script

Algob provides the functionality to do a test run of a TEAL smart contract. This option is useful to capture a transaction in an output file with associated state of the smart contract. This allows testing the TEAL logic in a dry run which allows to step by step follow the TEAL execution and inspect transaction approval or rejection.

The _dry run_ response from the Algorand REST API includes disassembly, logic signature messages with PASS/REJECT, a signature trace, app call messages, and an app call trace.

NOTE: The _dry run_ REST API is only available on a node if it has been enabled in the node's configuration (`EnableDeveloperAPI` = true).
Example:
```js
// txnParams are the input transactions
const debugger = new Tealdbg(deployer, txnParam);
await debugger.dryRunResponse('dryrun.json');
```

The DryRun Response will be dumped to `assets/dryrun.json`.

## Starting a debugging session

Instead of a dryrun execution, you can also start a debugging session (for example, with Chrome Developer Tools) in an `algob` script. This is helpful for setting up breakpoints in code, inspecting state after line by line execution etc.

Following params could be passed to debugger context:
* `tealFile`: Name of teal file (present in `assets/`) to pass to debugger.
* `mode`: Execution mode, either signature or application. Matches to Algod's evaluation mode for logic signature TEAL or application call TEAL. Read more about execution modes [here](https://github.com/algorand/go-algorand/blob/master/cmd/tealdbg/README.md#execution-mode).
* `--group-index`: In case of a transaction group, group index should be passed to specify the current transaction in group in a debugger session.

**NOTE:** Passing `tealFile` is *optional*, but *recommended*. If not passed, debugger is run with the decompiled version of teal code. Supplying the program will allow debugging the original source and not the decompiled version.

```js
// txnParams are the input transactions
const debugger = new Tealdbg(deployer, txnParam);
await debugger.run({ tealFile: '4-gold-asa.teal' }); // 4-gold-asa.teal present in assets/**/
```

NOTE: To configure the chrome listener for a debugging session, read [Configure the Listener](https://github.com/algorand/go-algorand/blob/master/cmd/tealdbg/README.md#configure-the-listener).

## Example Walkthrough

In this section we will try to debug a stateless transaction in [`/examples/asa`](https://github.com/scale-it/algo-builder/tree/master/examples/asa).

The smart contract used is [4-gold-asa.teal](https://github.com/scale-it/algo-builder/blob/master/examples/asa/assets/teal/4-gold-asa.teal) which ensures:
+ Transaction type is asset transfer and AssetAmount <= 1000.
+ Sender is `goldOwner` account.

First we need to deploy the contracts using `algob deploy`. We will debug a transaction defined in [`scripts/transfer/gold-delegated-lsig.js`](https://github.com/scale-it/algo-builder/blob/master/examples/asa/scripts/transfer/gold-delegated-lsig.js).

### DryRun
Setting up transaction params (note that this is a passing scenario as amount = 500 <= 1000):
```js
// load signed lsig from checkpoint
const lsigGoldOwner = deployer.getDelegatedLsig('4-gold-asa.teal');
const txnParam = {
  type: types.TransactionType.TransferAsset,
  sign: types.SignType.LogicSignature,
  fromAccountAddr: goldOwner.addr,
  toAccountAddr: john.addr,
  amount: 500,
  assetID: 'gold',
  lsig: lsigGoldOwner,
  payFlags: { totalFee: 1000 }
};
```
After setting up the transaction, let's try to execute dry run by adding the following lines to the script:
```
const debug = new Tealdbg(deployer, txnParam);
await debug.dryRunResponse('dryrun-pass.json');
```

It will create a `assets/dryrun-pass.json` file, which looks like (notice the logic-sig-message is PASS):
```
{
  "error": "",
  "protocol-version": "https://github.com/algorandfoundation/specs/tree/d050b3cade6d5c664df8bd729bf219f179812595",
  "txns": [
    {
      "disassembly": [
        "#pragma version 2",
        "intcblock 1 0 4 1000 10000",
        "bytecblock 0x20ee6e18c121cab6dfc0f94d3d97d9dce06453d6ad52d75cd85d5b35d86e1112",
        "global GroupSize",
        "intc_0 // 1",
        "==",
        "txn GroupIndex",
        "intc_1 // 0",
        "==",
        "&&",
        "txn AssetAmount",
        "intc_1 // 0",
        "==",
        "&&",
        "txn TypeEnum",
        "intc_2 // 4",
        "==",
        "txn Sender",
        "bytec_0 // addr EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
        "==",
        "&&",
        "txn AssetAmount",
        "intc_3 // 1000",
        "<=",
        "&&",
        "||",
        "txn TypeEnum",
        "intc_2 // 4",
        "==",
        "txn RekeyTo",
        "global ZeroAddress",
        "==",
        "&&",
        "txn CloseRemainderTo",
        "global ZeroAddress",
        "==",
        "&&",
        "txn Fee",
        "intc 4 // 10000",
        "<=",
        "&&",
        "&&",
        ""
      ],
      "logic-sig-messages": [
        "PASS"
      ],
      "logic-sig-trace": [
        {
          "line": 1,
          "pc": 1,
          "stack": []
        },
        {
          "line": 2,
          "pc": 10,
          "stack": []
        },
        {
          "line": 3,
          "pc": 45,
          "stack": []
        },
        {
          "line": 4,
          "pc": 47,
          "stack": [
            {
              "bytes": "",
              "type": 2,
              "uint": 1
            }
          ]
        },
        ...
```

### Starting a debugging session

Let's try to launch a new debugger session with the same txnParam as in the above section:

```js
await debug.run({ tealFile: '4-gold-asa.teal' });
```

This will start a new debugger session. Console looks like:
```bash
2021/07/16 04:29:12 Using proto: https://github.com/algorandfoundation/specs/tree/d050b3cade6d5c664df8bd729bf219f179812595
2021/07/16 04:29:12 Run mode: logicsig
2021/07/16 04:29:12 ------------------------------------------------
2021/07/16 04:29:12 CDT debugger listening on: ws://127.0.0.1:9392/75c19568422ff120671707bc2682e7a3ae6861fe3bdac37571b860efd417e7d7
2021/07/16 04:29:12 Or open in Chrome:
2021/07/16 04:29:12 devtools://devtools/bundled/js_app.html?experiments=true&v8only=false&ws=127.0.0.1:9392/75c19568422ff120671707bc2682e7a3ae6861fe3bdac37571b860efd417e7d7
2021/07/16 04:29:12 ------------------------------------------------
```

Now, we have a remote target set up in `chrome://inspect`

![image](https://user-images.githubusercontent.com/33264364/125868310-4e121128-db58-4670-aa5e-99ed492f3b94.png)

Click on **inspect** and start playing with the teal code!
![image](https://user-images.githubusercontent.com/33264364/125868869-b55f8e4e-71e9-4742-91b9-75d56bf333d6.png)

Script used in this walkthrough is `gold-delegated-lsig.debug.js` and can be found [here](https://github.com/scale-it/algo-builder/blob/support-tealdbg/examples/asa/scripts/transfer/gold-delegated-lsig.debug.js).
