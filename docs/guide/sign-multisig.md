---
layout: splash
---

# Multisignature Accounts

Multisignature accounts are a logical representation of an ordered set of addresses with a threshold and version. Multisignature accounts can perform the same operations as other accounts, including sending transactions and participating in consensus. The address for a multisignature account is essentially a hash of the ordered list of accounts, the threshold and version values. The threshold determines how many signatures are required to process any transaction from this multisignature account. Read more about multisignature accounts [here](https://developer.algorand.org/docs/features/accounts/create/#multisignature).

Check our [`/examples/multisig`](https://github.com/scale-it/algo-builder/tree/master/examples/multisig) for creation/usage of multisig accounts in an `algob` project.

## Use Case

In real world scenario, if we're executing transactions using a multisignature account, then to approve these transactions, min no. of signatures (by algorand account secret key) <= threshold are required. So, these transactions will involve an interaction of many users (accounts comprising of the multisig).

`algob` provides `sign-multisig` command to append current user's signature to the transaction file, and outputs the signed transaction in a new file (eg. `signed_out.txn`). Now, current user(say `john`) can either pass this file to another user, or if minimum signatures are met, then you can use [`executeSignedTxFromFile`](https://algobuilder.dev/api/algob/modules.html#executeSignedTxnFromFile) function to successfully send transaction to network.

## Example Usage

### Appending to an existing multisigned transaction

Say that a multisignature accounts is comprised of [`alice`, `bob`, `john`] with threshold 2 and version 1. `Alice` creates the multisignature transaction file (`file.txn`), and passes this file to `john`. Now john can use `algob sign-multisig` command to append his signature:

```bash
algob sign-multisig --account john --file file.txn
```

The above command will append john signature to the transaction file `file.txn` and will generate output file `file_out.txn`.

**Flags:**

- `--account <name>`: (required). Name of account present in `algob.config.js` to sign transaction with it's secret key.
- `--file <name>`: (required). Name of file (should be present in `/assets`) to be used an input transaction file.
- `--out <name>`: (optional). Name of output file in which signed transaction data is dumped (in `/assets`). Note: if `--out` is not passed, then input file name is appended `_out` and used as output file name (eg. `file_out.txn`).

### Creating a new multisigned transaction

In case the transaction fetched from file is an unsigned trasaction, you can also create a new multisigned transaction by supplying the multisig metadata as well (version, threshold, addrs) to the `algob sign-multisig` command.

Considering the above scenario, say if `Alice` wants to create a new multisignature transaction file, she can use:

```bash
algob sign-multisig --account alice --file unsigned.txn --v 1 --thr 2 --addrs <alice-addr>,<bob-addr>,<john-addr>
```

Additional flags passed are described below (note that these are required only in case of creating a new multisig transaction):

- `--v <version>`: Multisig version.
- `--thr <threshold>`: Multisig threshold.
- `--addrs <addr1>,<addr2>..<addrN>`: Comma separated addresses comprising of the multsig (addr1,addr2,..). Order is important.

Alternatively, you can also use [`signMultiSig`](https://algobuilder.dev/api/algob/modules.html#signMultiSig) function to create a new multisignature transaction, or append a signature to an existing one in a transaction.

### Group transaction

In case that the transaction file has a (msgpack encoded) transaction group, you can pass `--group-index` flag with `algob sign-multisig`, to specify the transaction which needs to be signed. Eg.

```bash
algob sign-multisig --account john --file group.txn --group-index 1
```

The above **will sign 2nd transaction** in `group.txn` file, and output the updated group (with 2nd transaction signed, rest same as original) in `group_out.txn`.

Note: Input file is an msgpack [encoded](https://github.com/algorand/go-algorand/blob/master/cmd/tealdbg/samples/txn_group.msgp) transaction group. For reference, check the decoded transaction group file [here](https://github.com/algorand/go-algorand/blob/master/cmd/tealdbg/samples/txn_group.json).
