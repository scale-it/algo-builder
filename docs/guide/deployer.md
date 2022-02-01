---
layout: splash
---

# [Deployer](https://algobuilder.dev/api/algob/interfaces/types.deployer.html)

Deployer wraps an SDK `AlgodV2` client and provides a higher level functionality to deploy [Algorand Standard Assets(ASA)](https://developer.algorand.org/docs/features/asa/) and [Stateful Smart Contracts(App)](https://developer.algorand.org/docs/features/asc1/stateful/) to the Algorand network:
* load ASA definition files
* load smart-contract files
* create transaction log and checkpoints.

It will protect you from deploying same ASA or stateful smart contract twice. It will store transaction log in a checkpoint and allow you to reference later (in other scripts or in REPL) deployed ASA.

Deployer class has the following modes:
- Deploy Mode: In deploy mode user can write or read the checkpoints, create transaction logs. Files that are directly placed in `scripts/` folder are considered to be run in this mode. Ex: `scripts/deploy.js`

- Run Mode: In run mode user can access/read checkpoints, create logs but cannot write(create) checkpoints. Files placed in nested folders (non-direct children) of `scripts/` folder are considered to be run in this mode. Ex: `scripts/transfer/run-script.js`.

  **Note:** In run mode user can `deploy`, `update`, `delete` or perform all these operations in a group transaction using [`executeTransaction`](https://algobuilder.dev/api/algob/modules.html#executetransaction) function but the `checkpoints will not be created when using run mode.`

Read more about deployment and scripts in our [spec](https://paper.dropbox.com/doc/Algorand-builder-specs--A_yfjbGmtkx5BYMOy8Ha50~uAg-Vcdp0XNngizChyUWvFXfs#:uid=213683005476107006060621&h2=Scripts).

## Example

When you initiate a new project, it will create a `sample-project` with the deployment script `scripts/0-sampleScript.js`,

You can write deployment tasks synchronously and they'll be executed in the correct order.

### ASA

    // ASA-1 will be deployed before ASA-2
    await deployer.deployASA("ASA-1", {...});
    await deployer.deployASA("ASA-2", {...});

To deploy an ASA you may have `asa.yaml` file in `assets` folder. Head to the [ASA Definition File Spec](https://paper.dropbox.com/doc/Algorand-builder-specs-Vcdp0XNngizChyUWvFXfs#:uid=077585002872354521007982&h2=ASA-Definition-File) to learn more.

To deploy an ASA without declaring it in `asa.yaml`, you can use:

    const asaDef = {
      total: 10000,
      decimals: 0,
      defaultFrozen: false,
      unitName: "SLV",
      url: "url",
      metadataHash: "12312442142141241244444411111133",
      note: "note"
    };
    await deployer.deployASADef("silver-122", asaDef, {...});

#### Deploying ASA with custom parameters

User can also override the fields in `assets/asa.yaml` when deploying ASA. Eg. If user wants to use a multisig address from 3 accounts: `alice, bob, john` as the Asset Reserve. We can create a multisig address in `algob` script first and then pass this address as a custom asaParams.

```javascript
const { createMsigAddress } = require('@algo-builder/algob');

const addrs = [alice.addr, bob.addr, john.addr];
const [mparams, multsigaddr] = createMsigAddress(1, 2, addrs); // version = 1, threshold = 2

// while deploying ASA pass custom asa param
await deployer.deployASA("ASA-2", {...}, { reserve: multsigaddr }); // this will overwrite reserve field from assets/asa.yaml
```

#### OptIn to ASA

For opting in to ASA, `deployer` supports following methods:
- `optInAccountToASA` to opt-in to a single account signed by secret key of sender.
- `optInLsigToASA` to opt-in to a contract account (say escrow) where the account is represented by the logic signature address (`lsig.address()`).
    To opt in to ASA you can use either `Asset Index` or `name of the ASA`. Using Asset Index is useful when asset is not deployed using deployer.

- There is one more method which you can use to opt-in, It can be used with group transactions also
  - `executeTransaction` to opt-in single account or contract account to ASA.
  - Ex: To opt-in a single account, Params will look like this:
  ```js
    const execParam: ExecParams = {
      type: TransactionType.OptInASA,
      sign: SignType.SecretKey,
      fromAccount: user.account,
      assetID: assetID,
      payFlags: payFlags
    };
  ```
  - Ex: To opt-in to a contract account
  ```js
    const execParam: ExecParams = {
      type: TransactionType.OptInASA,
      sign: SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      assetID: assetID,
      payFlags: payFlags
      lsig: lsig
    };
  ```

### Smart contracts

You can deploy Stateful/Stateless Smart Contracts (SSC).

#### Stateful Smart Contracts
Check our [examples/permissioned-voting](https://github.com/scale-it/algo-builder/tree/master/examples/permissioned-voting) project. Open the `scripts/voting.js` file, you will find there:

    await deployer.deployApp("approval.teal", "clear.teal", {...});

Smart contracts must be stored in `assets` folder.

The main difference between deploying an ASA and App is that ASA takes `asset-name` and `ASADeploymentFlags` as input and App takes `smart-contract-names` and `AppDeploymentFlags` as input.

You can learn more about the flags from [Deployer API](https://scale-it.github.io/algo-builder/api/algob/interfaces/types.deployer.html);
You can learn more about Stateful Smart Contracts [here](https://developer.algorand.org/docs/features/asc1/stateful/).

#### OptIn to App

For opting in to App, `deployer` supports the following methods:
- `optInAccountToApp` to opt-in to a single account signed by secret key of sender.
- `optInLsigToApp` to opt-in to a contract account (say escrow) where the account is represented by the logic signature address (`lsig.address()`).
  - To opt in to App you can use `Application Index`.[When the smart contract is created the network will return a unique ApplicationID. This ID can then be used to make ApplicationCall transactions to the smart contract. ](https://developer.algorand.org/docs/features/asc1/stateful/#call-the-stateful-smart-contract)

- Like with ASA, we can also use `executeTransaction` to opt-in a single account or contract account to App.
  - `executeTransaction` to opt-in single account or contract account to App.
  - Ex: To opt-in a single account, Params will look like this:
  ```js
    const execParam: ExecParams = {
      type: TransactionType.OptInToApp,
      sign: SignType.SecretKey,
      fromAccount: user.account,
      appID: appID,
      payFlags: payFlags
    };
  ```
  - Ex: To opt-in to a contract account
  ```js
    const execParam: ExecParams = {
      type: TransactionType.OptInToApp,
      sign: SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      appID: appID,
      payFlags: payFlags
      lsig: lsig
    };
  ```

#### Stateless Smart Contracts

- *Contract Mode:*

  Contract accounts act in a similar fashion to escrow accounts, where when the smart contract is compiled it produces an Algorand address. This address can accept Algos or Algorand ASAs with standard transactions, where the contract’s address is the receiver of the transaction.

  Contract accounts can be also be used to deploy ASAs.

   Check our [examples/htlc-pyteal-ts](https://github.com/scale-it/algo-builder/tree/master/examples/htlc-pyteal-ts) project to explore how to deploy Stateless Smart Contracts(lsig). In the file `scripts/deploy.ts`, you will find:

  ```
  await deployer.fundLsig('htlc.py',
    { funder: bob, fundingMicroAlgo: 2e6 }, {}, [], scTmplParams);
  ```
  `fundLsig` funds the contract account (compiled hash of the smart contract). The function `fundLsig` accepts `pyteal` code too, which provides the functionality of dynamically providing the params before compiling into TEAL code.

- *Delegated Signature Mode*:

  Stateless smart contracts can also be used to delegate signature authority. When used in this mode, the logic of the smart contract is signed by a specific account or multi-signature account. This signed logic can then be shared with another party that can use it to withdrawal Algos or Algorand ASAs from the signing account, based on the logic of the contract.

  Use `mkDelegatedLsig` function to compile and sign a logic signature & save it to checkpoint.
  ```javascript
  const ascInfoGoldDelegated = await deployer.mkDelegatedLsig('4-gold-asa.teal', goldOwner);
  console.log(ascInfoGoldDelegated);
  ```

You can learn more about Stateless Smart Contracts [here](https://developer.algorand.org/docs/features/asc1/stateless/).


#### Compile contracts

You can use the deployer API to compile smart contracts (ASC) and get the contract's bytecode, hash, compilation timestamp etc:
  * `compiledASC`: compiles a contract in real time, returns `ASCCache` object. Example:
  ```js
  const info = await deployer.compileASC('buyback-lsig.py', { ARG_DAO_APP_ID: 23 }, false);
  const bytecode = info.compiled;
  ```

  * `getDeployedASC`: Similar to above, but instead of compiling, it returns cached program (from artifacts/cache) by deployment name. 
