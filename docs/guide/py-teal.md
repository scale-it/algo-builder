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
- Deployer functions(`loadLogic`, `fundLsig`, `deploySSC`) take one extra optional argument: a smart contract parameters object(`scInitParam`). This argument is passed to PyTEAL script.
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

    print(compileTeal(dynamic_fee(
      scParam["ARG_AMT"],
      Addr(scParam["ARG_CLS"]), Mode.Signature))
  ```

#### In scripts

To use this feature in scripts, you can pass an external parameter object (using `loadLogic`, `fundLsig`..):
   ```js
    scInitParam = {
      ARG_AMT: 700000,
      ARG_CLS: masterAccount.addr
    }
    await deployer.loadLogic("dynamic-fee.py", scInitParam);
   ```

# TMPL Placeholder Support

- PyTEAL supports `Tmpl` fuction which can replace value with a constant.
  For ex: `Tmpl.Addr("TMPL_ADDR")`
  when converted to TEAL it will look like this `addr TMPL_ADDR`. now you can replace this constant to value of your choice.
- Algob supports these replacements. Ex:
   ```js
    scInitParam = {
      TMPL_TO: "ADDR"
    }
    await deployer.loadLogic("dynamic-fee.py", scInitParam);
   ```
   you can simply pass an object with replacement values, algob will replace them for you at the time of compilation.

- You can also use this feature with external support parameters: Ex:
   ```js
    scInitParam = {
      TMPL_TO: "ADDR",
      ARG_AMT: 700000,
      ARG_CLS: masterAccount.addr
    }
    await deployer.loadLogic("dynamic-fee.py", scInitParam);
   ```
  Keys starting with `TMPL_` or `tmpl_` will be used with TMPL function and other keys will be used as mentioned in `External Parameters Support` section.