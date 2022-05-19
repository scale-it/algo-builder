---
layout: splash
---

# PyTeal

PyTeal is a Python language binding for Algorand Smart Contracts (ASC1s).

- You can compile `PyTeal` files using `algob`.
- Intermediate TEAL code is stored in `cache` folder.

# Dependencies

- Install `Python3`
- Install PyTeal `pip3 install pyteal`

Please follow the main [README#PyTeal](https://github.com/scale-it/algo-builder#pyteal) file for setup instructions.

# Usage

- `algob compile` - compiles all files in `assets` folder with `.teal` as well as `.py` extension

# External Parameters Support

- We can use parameters in the PyTEAL code, however that parameters are hardcoded.
  If the address is loaded dynamically (eg from KMD), we can't use PyTEAL code prior to the address knowledge.
- If we have to deploy same contract multiple times with only difference of initialization variables, we will have to change the variables in PyTeal code everytime we deploy it.
- To solve this problem we have introduced a support for passing `external parameters`.
- Deployer functions(`loadLogicByFile`, `fundLsigByFile`, `deployApp`) take one extra optional argument: a smart contract parameters object(`scInitParam`). This argument is passed to PyTEAL script.
- Changing parameters will change a generated TEAL code. Hence it the Delegated Signature or Smart Contract address will be different and we may need to redeploy it.

### Usage

PyTEAL code uses [`algobpy`](https://github.com/scale-it/algo-builder/tree/master/examples/algobpy) module to parse and use external parameters. You can copy this module into your project directory to use it.

**NOTE**: In the `.py` contract, make sure to insert `algobpy` module in path.

```py
# Add directory to path so that algobpy can be imported
import sys
sys.path.insert(0, path) # replace path with path to algobpy in your project
```

#### In Smart Contract

- Example below shows how you can use external paramters in PyTeal code
- `parse_params` function overwrites the `scParam` object with `external parameters` object in below example.

  ```py
  # Add directory to path so that algobpy can be imported
  import sys
  sys.path.insert(0,'.') # "." represent current directory

  from algobpy.parse import parse_params

  if __name__ == "__main__":

    # replace these values with your customized values or pass an external parameter
    scParam = {
      "ARG_AMT": 700000,
      "ARG_CLS": "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
    }

    # Overwrite scParam if sys.argv[1] is passed
    if(len(sys.argv) > 1):
      scParam = parse_params(sys.argv[1], scParam)

    # Implement optimizer for improving performance and reducing resource consumption
    optimize_options = OptimizeOptions(scratch_slots=True)

    print(compileTeal(dynamic_fee(
      scParam["ARG_AMT"],
      Addr(scParam["ARG_CLS"]), Mode.Signature, optimize=optimize_options))
  ```

#### In scripts

To use this feature in scripts, you can pass an external parameter object (using `loadLogic`, `fundLsig`..):

```js
scInitParam = {
	ARG_AMT: 700000,
	ARG_CLS: masterAccount.addr,
};
await deployer.mkContractLsig("dynamicFee", "dynamic-fee.py", scInitParam);
await deployer.getLsig("dynamicFee");
```

# Using [TMPL](https://pyteal.readthedocs.io/en/stable/api.html?highlight=TMPL#pyteal.Tmpl) expression from pyTeal.

PyTEAL supports [`Tmpl`](https://pyteal.readthedocs.io/en/stable/api.html?highlight=TMPL#pyteal.Tmpl) which is a template expression for creating placeholder values.
The name to use for this template variable must start with `TMPL_` and only consist of uppercase alphanumeric characters and underscores.
For ex: `Tmpl.Addr("TMPL_ADDR")`, `Tmpl.Int("TMPL_COUNTER")`, `Tmpl.Bytes("TMPL_BYTES")`.
when converted to TEAL it will look like this `addr TMPL_ADDR`. now you can replace this constant to value of your choice using `algob`.

### Example Walkthrough

- Consider a pyTeal code snippet `asc.py`:

  ```py
  pay_gold = And(
    Txn.type_enum() == TxnType.AssetTransfer,
    Txn.sender() == Tmpl.Addr("TMPL_SENDER"),
    Txn.asset_amount() <= Tmpl.Int("TMPL_AMOUNT")
  )
  ```

  This code will only approve the transaction if sender is "TMPL_SENDER" and
  asset amount is less than "TMPL_AMOUNT". Now you can replace these placeholders using `algob`.

  While using with algob you can replace these placeholder with the following:

  ```js
  const scInitParam = {
    TMPL_SENDER: bob.addr // bob address
    TMPL_AMOUNT: 100 // this could be any integer
  }
  await deployer.mkContractLsig("asc", "asc.py", scInitParam);
  await deployer.getLsig('asc');
  ```

  You can pass an object with replacement values, algob will replace them for you at the time of compilation.

  You can have multiple Tmpl expressions with same placeholder, `algob` will find and replace each of them.

  ### Difference between External Parameters Support and TMPL Placeholder Support

  - To understand the difference you need to know how TMPL works, you can learn from [here](https://pyteal.readthedocs.io/en/stable/api.html?highlight=TMPL#pyteal.Tmpl).
  - The main difference is, In TMPL placehlder support TMPL placeholders are replaced with given values after transpiling pyTEAL to TEAL language, but in case of external parameters, replacment of values is done in pyTEAL file only.
