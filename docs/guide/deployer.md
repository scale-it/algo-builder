---
layout: splash
---

# [Deployer](https://algobuilder.dev/api/algob/interfaces/types.deployer.html)

Deployer wraps an SDK `AlgodV2` client and provides a higher level functionality to deploy [Algorand Standard Assets(ASA)](https://developer.algorand.org/docs/features/asa/) and [Stateful Smart Contracts(App)](https://developer.algorand.org/docs/features/asc1/stateful/) to the Algorand network:

- load ASA definition files
- load smart-contract files
- create transaction log and checkpoints.

It will protect you from deploying same ASA or stateful smart contract twice. It will store transaction log in a checkpoint and allow you to reference later (in other scripts or in REPL) deployed ASA.

Deployer class has the following modes:

- Deploy Mode: In deploy mode user can write or read the checkpoints, create transaction logs. Files that are directly placed in `scripts/` folder are considered to be run in this mode. Ex: `scripts/deploy.js`
  To run a script in the _deploy_ mode (the script will receive deployer instance in _deploy_ mode\_):

        yarn run algob deploy scripts/script_name.js

- Run Mode: In run mode user can access/read checkpoints, create logs but cannot write(create) checkpoints. Files placed in nested folders (non-direct children, eg: `scripts/transfer/run-script.js`) of `scripts/` folder are considered to be run in this mode.
  To run a script in the _run_ mode (the script will receive deployer instance in _run_ mode\_):

        yarn run algob run scripts/transfer/run-script.js

**Note:** In run mode user can `deploy`, `update`, `delete` or perform all these operations in a group transaction using [`executeTx`](https://algobuilder.dev/api/algob/modules.html#executetransaction) function but the `checkpoints will not be created when using run mode.`

Read more about deployment and scripts in our [spec](https://paper.dropbox.com/doc/Algorand-builder-specs--A_yfjbGmtkx5BYMOy8Ha50~uAg-Vcdp0XNngizChyUWvFXfs#:uid=213683005476107006060621&h2=Scripts).

## Example

When you initiate a new project, it will create a `sample-project` with the deployment script `scripts/0-sampleScript.js`,

You can write deployment tasks synchronously and they'll be executed in the correct order.
Below we will guide you how to use the deployer to create ASA and smart contracts. Please look at our [templates](https://github.com/scale-it/algo-builder/tree/master/examples) for more more details how to create to organize files in scripts directory. The [asa example](https://github.com/scale-it/algo-builder/tree/master/examples/asa) the best one to start.

### Deploying ASA

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
const [mparams, multisigAddr] = createMsigAddress(1, 2, addrs); // version = 1, threshold = 2

// while deploying ASA pass custom asa param
await deployer.deployASA("ASA-2", {...}, { reserve: multisigAddr }); // this will overwrite reserve field from assets/asa.yaml
```

#### OptIn to ASA

For opting in to ASA, `deployer` supports following methods:

- `optInAccountToASA` to opt-in to a single account signed by secret key of sender.
- `optInLsigToASA` to opt-in to a contract account (say escrow) where the account is represented by the logic signature address (`lsig.address()`).
  To opt in to ASA you can use either `Asset Index` or `name of the ASA`. Using Asset Index is useful when asset is not deployed using deployer.

- There is one more method which you can use to opt-in, It can be used with group transactions also
  - `executeTx` to opt-in single account or contract account to ASA.
  - Ex: To opt-in a single account, Params will look like this:
  ```js
  const execParam: ExecParams = {
  	type: TransactionType.OptInASA,
  	sign: SignType.SecretKey,
  	fromAccount: user.account,
  	assetID: assetID,
  	payFlags: payFlags,
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

    await deployer.deployApp(creator, appDefinition,...);

Smart contracts must be stored in `assets` folder.

The main difference between deploying an ASA and App is that ASA takes `asset-name` and `ASADeploymentFlags` as input and App takes `smart-contract-names` and `AppDeploymentFlags` as input.

You can learn more about the flags from [Deployer API](https://algobuilder.dev/api/algob/interfaces/types.Deployer.html);
You can learn more about Stateful Smart Contracts [here](https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/).
#### OptIn to App

For opting in to App, `deployer` supports the following methods:

- `optInAccountToApp` to opt-in to a single account signed by secret key of sender.
- `optInLsigToApp` to opt-in to a contract account (say escrow) where the account is represented by the logic signature address (`lsig.address()`).

  - To opt in to App you can use `Application Index`.[When the smart contract is created the network will return a unique ApplicationID. This ID can then be used to make ApplicationCall transactions to the smart contract. ](https://developer.algorand.org/docs/features/asc1/stateful/#call-the-stateful-smart-contract)

- Like with ASA, we can also use `executeTx` to opt-in a single account or contract account to App.
  - `executeTx` to opt-in single account or contract account to App.
  - Ex: To opt-in a single account, Params will look like this:
  ```js
  const execParam: ExecParams = {
  	type: TransactionType.OptInToApp,
  	sign: SignType.SecretKey,
  	fromAccount: user.account,
  	appID: appID,
  	payFlags: payFlags,
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

#### Smart Signatures

- _Contract Mode:_

  Contract accounts act in a similar fashion to escrow accounts, where when the smart contract is compiled it produces an Algorand address. This address can accept Algos or Algorand ASAs with standard transactions, where the contract’s address is the receiver of the transaction.

  Contract accounts can be also be used to deploy ASAs.

  Check our [examples/htlc-pyteal-ts](https://github.com/scale-it/algo-builder/tree/master/examples/htlc-pyteal-ts) project to explore how to deploy Smart Signatures (lsig). In the file `scripts/deploy.ts`, you will find two methods to fund an lsig (by file, or by name):

  - By Name (default behaviour):

    ```js
    await deployer.mkContractLsig("HTLC_Lsig", "htlc.py", scTmplParams);
    // no need to pass smTmplParams again and again
    await deployer.fundLsig("HTLC_Lsig", { funder: bob, fundingMicroAlgo: 2e6 }, {});
    ```

  - By File (legacy behaviour):
    ```js
    await deployer.fundLsigByFile(
    	"htlc.py",
    	{ funder: bob, fundingMicroAlgo: 2e6 },
    	{},
    	[],
    	scTmplParams
    );
    ```

  `fundLsigByFile`/`fundLsig` funds the contract account (compiled hash of the smart contract). The function `fundLsigByFile` accepts `pyteal` code too, which provides the functionality of dynamically providing the params before compiling into TEAL code.

- _Delegated Signature Mode_:

  Smart Signatures can also be used to delegate signature authority. When used in this mode, the logic of the smart contract is signed by a specific account or multi-signature account. This signed logic can then be shared with another party that can use it to withdrawal Algos or Algorand ASAs from the signing account, based on the logic of the contract.

  Use `mkDelegatedLsig` function to compile and sign a logic signature & save it to checkpoint.

  ```javascript
  const ascInfoGoldDelegated = await deployer.mkDelegatedLsig(
  	"goldASC",
  	"4-gold-asa.teal",
  	goldOwner
  );
  console.log(ascInfoGoldDelegated);
  ```

You can learn more about Logic Signatures[here](https://developer.algorand.org/docs/features/asc1/stateless/).

#### Checkpoint names

Algob creates [checkpoint](https://algobuilder.dev/guide/execution-checkpoints.html) and associates them with a name. This is a very useful feature. For example, you don't need to pass smart contract template parameters every time when getting app info, or loading a logic signature. Since `algob v4.0`, we support naming for apps (Algorand stateful smart contracts) and smart signatures.

##### App Name

`deployer.deployApp` requires `appName` when deploying an application. The app metadata in checkpoint will be stored against "appName". Eg.

```js
// deployment
const daoAppInfo = await deployer.deployApp(
	creator,
	{
    metaType: MetaType.FILE
	  approvalProgramFilename: "dao-app-approval.py",
	  clearProgramFilename: "dao-app-clear.py",
		localInts: 9,
		localBytes: 7,
		globalInts: 4,
		globalBytes: 2,
		appArgs: appArgs,
    appName: 'DAO App'
	},
	{},
	{},
); // app name passed here

// now during querying, you only need this app name
const appInfo = deployer.getApp("DAO App");
```

#### Smart Signature Name

Similar to storing app names, you can store lsig info against name in a checkpoint. To store delegated lsig use `mkDelegatedLsig` function, and to store contract lsig info, use `mkContractLsig` function. Eg.

```js
const bob = deployer.accountsByName.get("bob");
// store delegatedLsig
await deployer.mkDelegatedLsig("DLsig", "file.py", bob, { ARG_DAO_APP: 1 });

// now during querying, you only need this lsig name
const lsigInfo = deployer.getLsig("DLsig");
```

Similarly for contract lsig:

```js
// store contract lsig
await deployer.mkContractLsig("CLsig", "file.py", { ARG_DAO_APP: 1 });

// now during querying, you only need this lsig name
const lsigInfo = deployer.getLsig("CLsig");
```

**NOTE:** For contract lsig you generally don't require to save info in checkpoint, but we recommend it so that it creates an entry in checkpoint, and then you can directly use `deployer.getLsig(<name>)` to query it's data. Alternatively, you can also use `deployer.loadLogicByFile`.

#### Managing Artifacts

Artifacts folder (`/artifacts`) comprises of two folders:

- `scripts/`: these contain the checkpoints and transaction logs while executing your "direct" (deployment) scripts. Checkpoints can be stored against a name (for an `app` or `lsig`), or against filenames (eg. `dao-app.py`, `treasury-lsig.py`).
- `cache/`: these contain `.yml` files which stores "cached" teal code. During any kind of transaction processing (`fundLsigByFile`, `loadLogicByFile`, `deployApp` ..etc) if there is an intermediary compilation of teal code, it is stored in `artifacts/cache`. So that next time, this compiled code can be directly used.

In the next section we'll see how to compile your contracts in real time (or load from cache) using filenames and app/lsig names.

##### Compile contracts

You can use the deployer API to compile smart contracts (ASC) and get the contract's bytecode, hash, compilation timestamp etc:

- `compiledASC`: compiles a contract in real time, returns `ASCCache` object. Example:

```js
const info = await deployer.compileASC("buyback-lsig.py", { ARG_DAO_APP_ID: 23 }, false);
const bytecode = info.compiled;
```

- `getDeployedASC`: Similar to above, but instead of compiling, it returns cached program (from artifacts/cache) by app or lsig name.

```js
// lsig
const info = await deployer.getDeployedASC("MyApp");
const [approvalInfo, clearInfo] = [info.approval, info.clear];

const lsigInfo = await deployer.getDeployedASC("MyLsig");
```

## Helper methods

`Deployer` class expose helper methods to improve developer's experience with the framewok. These methods can be also found under the same name and for most of the time with the same interfaces in `myalgowallet-mode`, `web-mode`, `wallectconnect-mode` and `Runtime`. These methods enable users to use `algosdk` types like `Transaction` and `SignedTransaction`. 
List of the methods:
- `makeTx` - creates`Transaction` object from `execParams`
- `signTx` - signes `Transaction` and returns `SignedTransaction` object.
- `makeAndSignTx` - combines funcnionality of the two methods listed above
- `sendTxAndWait` - sends `SignedTransaction` and waits for the response that is returned to the user.

### Practical example:
```ts
const execParams: AlgoTransferParam = {
			type: TransactionType.TransferAlgo,
			sign: SignType.SecretKey,
			fromAccount: alice,
			toAccountAddr: bob.addr,
			amountMicroAlgos: 10000n,
			payFlags: {},
		};
const signature: wtypes.Sign = {
  sign: SignType.SecretKey,
  fromAccount: alice,
};
const txnParams = await getSuggestedParams(deployer.algodClient);
const signedTx = await deployer.makeAndSignTx([execParams], txnParams, signature);
//second parameter below coresponds to number of rounds
//the method will wait for the response (10)
const txReceipt = await deployer.sendTxAndWait(signedTx,10);
```