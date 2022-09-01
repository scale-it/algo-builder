<!--
Guidelines:
+ provide short description which is easy to understand both to project managers and developers,
+ be very precise about breaking changes,
+ mark deprecated API,
+ provide link to documentation wheneve needed,
+ if relevant, you can also provide a link to a pull request.

Organize change log in the following section (in that order):
Features, Bug Fixes, API Breaking, Deprecated, Infrastructure, Template Updates
-->

# CHANGELOG

## Unreleased

- Updated yarn to v3.2.1
- Changed default sample project license to ISC
- Fix `txn AssetSender` should return zero address by default.

#### Examples

- Added secret key to all accounts that are signing transactins in examples. 

### Features

- Add `--npm` flag to `algob init` and `algob unbox`. Note: by default we will use `yarn`.
- Improved `algob/project-dev-script.sh` which is script setting up a local project.
- Add `waitRounds` params to `sendAndWait` method. `waitRounds` is option argument and have dlsefault value is 10.
- Add `Uint8Array` as a supported type for `TxParams.note`
- Added `sendSignedTransaction(signedTransaction)` to `Runtime`. Method takes '`SignedTransaction` type
from `algosdk` and sends it to the network. 
- Added support for `SignedTransaction` object in `executeTx` method in `Runtime`.
- Added verification for secret key signatures in `Runtime`.
- Added replace2 and replace3 opcode to `runtime`.
- Added sha3_256 opcode to `Runtime`

#### @algo-builder/web
- Added `appendSignMultisigTransaction` function to `WebMode` for appending signature to multisig transaction in the algosigner.

### Bug Fixes

- Fix `txn AssetSender` should return zero address by default.
- Fix `KMDCredentialsFromEnv` loading using KMD_DATA. Algob was trying to use `env.$KMD_DATA` instead of `env.KMD_DATA`
- Fix `gitxna 1 Logs 0` opcode. Previously any attempt to use this opcode would result in a "Not supported" error.
- Fix `TxParams.noteb64` encoding - should use base64 decoder rather than TextEncoder.

### Examples

#### DAO

- Add `add_proposal_with_asset.js` script use for create proposal with asset funds.

## v5.0.1 2022-07-11

### Bug Fixes

- added missing dependency (`debug`) to packages.

## v5.0.0 2022-07-8

### Features

#### Algob

- `algob.balanceOf(deployer, accountAddr, assetID)`: if assetID is undefined then the function will return ALGO account balance.
- `deployer.executeTx` returns list of `TxnReceipt`, which extends `ConfirmedTxInfo`. This is to add a useful `txID` attribute, needed in various scripts.

  ```ts
  export interface TxnReceipt extends ConfirmedTxInfo {
  	txID: string;
  }
  ```

#### Runtime

- Add `Runtime.getAppByName(appName)`: gets app info based on the name declared in appDefinition.
- Better warning/error when deploying ASA. Throws an error when ASA definition is wrong or when ASA is not found in asa.yaml, eg when Runtime needs to query ASA.
- Add `Runtime.getAppByName(appName)`. We can get application in Runtime now.
- Teal v6 support:
  - Add `Txn LastLog` opcode.
  - Add `Txn StateProofPK` opcode.

#### Examples

- Add new example [Trampoline](https://github.com/algorand-devrel/demo-avm1.1/tree/master/demos/trampoline)

### Bug Fixes

- Fix: missing schebang to run `algob` as an app directly. BTW, we recommend running algob through `yarn algob` in your project.
- Fix: max number of transactions in one call should be 256 (include inner and atomic transaction).
- Fix: Web mode (algo-builder/web) cannot sign by `fromAccount` when `fromAccountAddr` appear in `execParams`.
- Receipt confirmed txn have `inner-txns` and `txn` field.

### Breaking Changes

#### @algo-builder/algob

- `ensureCompiled` is deprecated and removed and `compileASC` should be used.
- `loadLogicFromCache` is deprecated and removed and `getLsigFromCache` should be used.
- `executeTransaction` is deprecated and removed and `executeTx` should be used.

#### @algo-builder/runtime

- `addAsset` is deprecated and removed and `deployASA` should be used.
- `addApp` is deprecated and removed and `deployAdd` should be used.
- `addASADef` is deprecated and removed and `deployASADef` should be used.
- Renamed `optIntoAsa` to `optInToAsa` to remain naming convention consistency across the project.

#### @algo-builder/web

- `executeTransaction` is deprecated and removed and `executeTx` should be used.
- Renamed `sendTransaction` to `sendAndWait` in WebMode and parameter is updated to accept `string` to bring consistency with other wallets class.

### Deprecated

### Infrastructure

- Updated indexer version to `2.12.4` in `infrastructure/makefile`

### Template Updates

DAO template:

- [breaking] moved template parameter (`gov_token_id`) to the global state. This is to assure constant bytecode fir each deployment. We need it to build an efficient indexer and UI.
  - Subsequently, `gov_token_id` is required when deploying new DAO approval program.

## v4.0.0 2022-05-24

### Features

- use`logger` from `debug` package for logging utility in place of all console calls.

Core:

- Added support for saving smart contract template params in ASCCache.
- The `compile.ts` has been updated and now the tealCode is stored in cache when `scTmplParams` are used to compile TEAL with hardcoded params.
- Added following functions in `deployer` API
  - `getDeployedASC`: returns cached program (from artifacts/cache) `ASCCache` object by name. Supports both App and Lsig.
- You can initialize an new `algob` project with `infrastructure` scripts (a copy the `/infrastructure` directory in repository) by adding the `--infrastructure` flag. Example:
  ```bash
    algob init --infrastructure
  ```
- Return list of receipts for each txn in group txn. Example:

```js
const receipts = deployer.executeTx([txn0, txn1]);
console.log("txn0 information: ", receipts[0]);
console.log("txn1 information: ", receipts[2]);
```

JS Runtime and testing features:

- `runtime.defaultAccounts` - a list of pre-generated 16 accounts with pre-defined addresses and keys, each with 1e8 microAlgos (100 Algos)
- `runtime.resetDefaultAccounts()` - will recreate the default accounts (reset their state).
- unit tests that cover new scenarios when `runtime.defaultAccounts` and `runtime.resetDefaultAccounts()` are used.
  - `bond-token-flow` test to also use runtime.defaultAccounts. (see [example](https://github.com/scale-it/algo-builder/blob/develop/examples/bond/test/bond-token-flow.js))
- Support execution of algo-sdk-js `transactionAndSign` in Runtime [#601](https://github.com/scale-it/algo-builder/pull/601).
- Added support for checking against opcode their execution mode in runtime. For eg. `arg` can only be run in _signature_ mode, and parser will reject the execution if run in application mode.
- Support RekeyTo field in the inner transaction for TEAL v6.
- Support `keyreg` transaction in inner transaction in JS runtime.
- Enable transfer ALGO to a not regeistred account.
- Every opcode class has been updated and now their `execute` method returns its cost.
- Teal V6 support:

  - Add new opcode `bsqrt` and `divw`([##605](https://github.com/scale-it/algo-builder/pull/605)).
  - Add new opcode `gloadss`([#606](https://github.com/scale-it/algo-builder/pull/606)).
  - Add new opcode `acct_params_get`([#618](https://github.com/scale-it/algo-builder/pull/618)).
  - Add new opcode `itxn_next`([#626](https://github.com/scale-it/algo-builder/pull/626)).
  - Add new opcode `gitxn`, `gitxna` and `gitxnas`.([#628](https://github.com/scale-it/algo-builder/pull/628)).
  - Contract to contract calls. However we limit c2c call with only AppCall(NoOpt) transactions.([#611](https://github.com/scale-it/algo-builder/pull/611))
  - Full support for inner transactions: `itxn`, `itxna` and `itxnas`

- Teal v7 support:

  - opcode `base64decode` ([##653](https://github.com/scale-it/algo-builder/pull/653))

- `algob test` now runs tests recursively in `test` directory and subdirectories. Before only the files inside the test directory where run.

Dependencies:

- Upgraded PyTEAL version [`0.13.0`](https://github.com/algorand/pyteal/releases/tag/v0.13.0) in Pipfile.
- Upgraded JS SDK to v1.16.0

### API Breaking

- Improved the smart contract deployment process. We changed the `DeployASAParam` and `DeployASCParam` to make it more explicit. The `deployer.deploy*` also got improvemetns with a cost of API breaking. We created the following types to describe the smart-contract to be deplyed:

```ts
// from file
type SourceFile = {
	metaType: MetaType.FILE;
	approvalProgramFilename: string;
	clearProgramFilename: string;
};

// from teal source code (string).
type SourceCode = {
	metaType: MetaType.SOURCE_CODE;
	approvalProgramCode: string;
	clearProgramCode: string;
};

// from compiled source code.
type SourceCompiled = {
	metaType: MetaType.BYTES;
	approvalProgramBytes: Uint8Array;
	clearProgramBytes: Uint8Array;
};
```

And the following types are added for the Smart Contract definition

```ts
export type AppDefinitionFromFile = StorageConfig & AppOptionalFlags & SourceFile;

export type AppDefinitionFromSource = StorageConfig & AppOptionalFlags & SourceCode;

export type AppDefinitionFromSourceCompiled = StorageConfig & AppOptionalFlags & SourceCompiled;

export type AppDefinition =
	| AppDefinitionFromFile
	| AppDefinitionFromSource
	| AppDefinitionFromSourceCompiled;

export type DeployAppParam = BasicParams & {
	type: TransactionType.DeployApp;
	appDefinition: AppDefinition;
};
```

See [packages/web/src/types.ts](https://github.com/scale-it/algo-builder/blob/master/packages/web/src/types.ts) for more details.

- We have updated parameters of `deployApp` method:

```ts
/// old
  /**
	 * deploy a new application and returns application id
	 * @param approvalProgram application approval program (TEAL code or program filename)
	 * @param clearProgram application clear program (TEAL code or program filename)
	 * @param flags SSCDeployment flags
	 * @param payFlags Transaction parameters
	 * @param scTmplParams Smart Contract template parameters
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	deployApp(
		approvalProgram: string,
		clearProgram: string,
		flags: AppDeploymentFlags,
		payFlags: types.TxParams,
		scTmplParams?: SCParams,
		debugStack?: number
	): {...}

/// new
	/**
	 * deploy a new application and returns application id
	 * @param payFlags Transaction parameters
	 * @param appDefinition app definition
	 * @param scTmplParams Smart Contract template parameters
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	deployApp(
		sender: AccountSDK,
		appDefinition: types.AppDefinition,
		payFlags: types.TxParams,
		scTmplParams?: SCParams,
		debugStack?: number
	):
```

- We have changed the parameters of `updateApp` method. Details:

```ts
  // old
	/**
	 * Update application
	 * @param senderAddr sender address
	 * @param appID application Id
	 * @param approvalProgram new approval program (TEAL code or program filename)
	 * @param clearProgram new clear program (TEAL code or program filename)
	 * @param payFlags Transaction parameters
	 * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	updateApp(
		senderAddr: string,
		appID: number,
		approvalProgram: string,
		clearProgram: string,
		payFlags: types.TxParams,
		flags: AppOptionalFlags,
		scTmplParams?: SCParams,
		debugStack?: number
	)

  // new
  /**
	 * Update application
	 * @param appName application Name. Note in runtime application name just placeholder params
	 * @param senderAddr sender address
	 * @param appID application Id
	 * @param newAppCode new application source code
	 * @param payFlags Transaction parameters
	 * @param flags Stateful smart contract transaction optional parameters (accounts, args..)
	 * @param debugStack: if passed then TEAL Stack is logged to console after
	 * each opcode execution (upto depth = debugStack)
	 */
	updateApp(
		appName: string,
		senderAddr: string,
		appID: number,
		newAppCode: types.SmartContract,
		payFlags: types.TxParams,
		flags: AppOptionalFlags,
		scTmplParams?: SCParams,
		debugStack?: number
	)
```

- The `appName` field is required now. We can use `deployer.getApp(appName)` to get checkpoint data of application. In web-mode, you can set it empty.

- We removed `runtime.addApp`, `deployer.getAppByFile` methods.

- We have changed the naming convention for the clearing proposal part of the DAO:

  - Renamed `clearProposal` to `closeProposal`,
  - Renamed `clear_proposal` to `close_proposal`,
  - Renamed `mkClearProposalTx` to `mkCloseProposalTx`.

- We have updated the default behavior of algob deployer for loading data from checkpoint to be queried by "app/lsig" name (note: passing name is required). The existing functionality has been moved to `<func>ByFile` functions (legacy functions based on file querying):

  - Application:

    - Previous `getApp(approval.py, clear.py)` has been changed to `getAppByFile(approval.py, clear.py)`.
    - New `getApp(appName)` function queries app info using the app name.

  - Smart signatures:
    - Existing `getDelegatedLsig(lsig.py)`, `getContractLsig(lsig.py)` **have been removed**. Use `getLsig` function to query logic signature from name or filename in a checkpoint.
    - New `getApp(appName)` function queries app info using the app name.
    - Existing `fundLsig(lsig.py, ..)` function has been changed to `fundLsigByFile(lsig.py, ..)`. Now `fundLsig(lsigName, ..)` will take lsig name.
    - Existing `mkDelegatedLsig(fileName, signer, ..)`, `mkContractLsig(fileName, ..)` have been updated to take the **lsigName as a required parameter (first parameter passed to function)**:
      - `mkDelegatedLsig(lsigName, fileName, signer)`
      - `mkContractLsig(lsigName, fileName)`.
        Here `fileName` represent the name of smart contract file (eg. `treasury-lsig.teal`), and `lsigName` represents the "name" you want to assign to this lsig (eg. `treasuryLsig`).

  For reference you can check out `examples/asa`.

- Updated `getLsig`, `getDelegatedLsigByFile`, `getContractLsigByFile`, `getApp` to throw an error if information against checkpoint (by name or file) is not found.
- Updated `TxReceipts` for runtimes' `deployApp`, `deployASA` to use same types as algob (`AppInfo`, `ASAInfo`).
- Updated `txId` key in returned App/ASA info to `txID`.

- `printLocalStateSCC` renamed to `printLocalStateApp`.
- `printGlobalStateSCC` renamed to `printGlobalStateApp`.

- The ` PyASCCache` has been merged to `ASCCache` and is not used anymore.
- Only use list transaction in executeTx.
- Rename the executeTransaction to executeTx

- The `Deployer` interface now contains a new method `executeTx` while the old function is still supporoted it is
  recommended to use the method from `Deployer` rather than the function dirrectly.

- `executeTx` method from `WebMode` class now returns `Promise<algosdk.modelsv2.PendingTransactionResponse>` .

### Bug fixes

- Return error when closeRemainderTo and fromAccountAddr is the same.
- When close account should remove auth/spend address. Fixed in [#575](https://github.com/scale-it/algo-builder/pull/575).
- Approval program and clear program should throw error if they are mismatch version. Fixed in [#620](https://github.com/scale-it/algo-builder/pull/620)
- Allow token to be empty.
- Throw error when issue inner transactions in clear program. Fixed in [#667](https://github.com/scale-it/algo-builder/pull/667).
- Parameters in `extract*` opcodes can greater than uint8. Fixed in [#666](https://github.com/scale-it/algo-builder/pull/666).
- Wallet constructor come from a parameter walletURL(token, server, port)
- Restrict duplicate transaction in group transaction.

### Infrastructure

- Updated `setup-master-account` and `sandbox-setup-master-account` commands to run multiple times.

### Template Updates

- We updated the examples/DAO design. We removed treasury Smart Signature to simplify deposit management. Now a DAO app is managing voting, deposits and treasury.
- Enabled PyTEAL Optimizer option in all our examples.

## v3.2.0 2022-02-03

### Features

- Added following functions in `deployer` API
  - `compileASC`: alias to `deloyer.ensureCompiled`. The latter is now marked deprecated and `compileASC` should be used instead.
  - `getDeployedASC`: returns cached program (from artifacts/cache) `ASCCache` object by name.
- Added `sandbox-up-dev` and `sandbox-reset` commands into Makefile in `infrastructure/`.
- Use strict parsing rules when decoding PyTEAL teamplate parameters using `algobpy`. Previously, on decode failure, the script was continuing with partially updated template params, now we fail with an exception.

Dependencies:

- Updated `algosdk` to `v1.13.1`

### Bug Fixes

- Int Pseudo-Ops can't start with 0x(hex) or 0(oct) prefix. (#562)
- Add missing opcode `bitlen` and `app_params_get`.
- In the inner transaction, `snd` always the application address. However, it can be set to an arbitrary address. Fixed in [#569](https://github.com/scale-it/algo-builder/pull/569).

### Notes

We continue to use yarn v3. Please share your feedback about it. Hope this improved your workflow.

**Full Changelog**: https://github.com/scale-it/algo-builder/compare/v3.1.0...v3.2.0

## v3.1.0 2022-01-25

In this release we migrated to yarn v3. It speed up package management a lot.
We use node-modules node linker, because this is required
`npm` or `yarn v1` still works, but to have the best experience with `algob`,
you should install and use yarn v3:

```
yarn set version stable
yarn install
```

### Features

- Beta support for rekeying transactions in `@algo-builder/runtime` / testing.
- Added integration to `tealer` tool into pipenv.
- updated sample-project (the one after `algob init`)
- migrate to use yarn v3
- updated dependencies to the latest version (notably: algosdk, typescirpt, eslint, mocha)

### Bug Fixes

- `Runtime` wrongly required that an address used in `acfg` ItxnField refers to an existing account. However, addresses used in `acfg` or create asset transactions may refer to a not existing account. [PR](https://github.com/scale-it/algo-builder/pull/550). Reported by @patrick
- Can't get LogicSigAccount from `deployer.getDelegatedLsig`.
- `uncover` opcode push/pop wrong order.
- example/nft: fixed script (related to api breaking change).
- problem with calculating gas when a program starts with label (#547)

## v3.0.0 2021-12-22

### Features

- TEALv5 support in `@algo-builder/runtime` [AVM 1.0](https://developer.algorand.org/articles/discover-avm-10/):
  - Cover, Uncover opcodes
  - Loads, Stores opcodes
  - Extract, Extract3 opcodes
  - ExtractUint16, ExtractUint32, ExtractUint64 opcodes
  - Txn, Global fields
  - Added application account (a smart contract now has an escrow account). Updated checkpoint structure to store `applicationAccount` while running `algob` scripts.
  - Support Inner Transactions: `Payment`, `AssetTransfer`, `AssetFreeze`, `AssetRevoke`, `AssetDeploy`, `AssetModify`, `AssetDelete`.
  - Support Pooled opcode budget
  - Txnas, Gtxnas, Gtxnsas, Args, Log (logs are stored in txReceipt)

* Update all transaction functions (eg. `executeTx`, `addAsset`, `addApp` ..etc) to return a transaction receipt. Add `runtime.getTxReceipt` in `@algo-builder/runtime` to query transaction info.

- Add Asset Name to `assetDefinition` in `@algo-builder/runtime`.
- Updated App, Asset counters in runtime from 0, to 8. This means that the newly created App/Asset Index will be 9 (instead of 1).
- Added `runtime.loadLogic(..)` function (similar to `deployer.loadLogic` API) which simplifies the testing and script flow (we can use the same code in tests and scripts). User _should do_ the following migration:

  ```js
  // from
  const daoFundLsigProg = getProgram("dao-fund-lsig.py", scInitParam);
  daoFundLsig = runtime.createLsigAccount(daoFundLsigProg, []);

  // to (mute logs)
  daoFundLsig = runtime.loadLogic("dao-fund-lsig.py", scInitParam, false);
  ```

  For information about loading checkpoint(s) data using `@algo-builder/web` in a webapp, read [here](https://github.com/scale-it/algo-builder/blob/master/docs/guide/algob-web.md#checkpoints).

- Added `WallectConnectSession` class to create & manage wallect connect session. User can use `session.executeTransaction()` to execute algob transactions using wallet connect.
- Updated `getProgram`, `loadLogic` to pass an optional argument: `logs (true/false)`. By default logs will be displayed on console during compilation.
  ```js
  // logs == false
  const daoFundLsigProg = getProgram("dao-fund-lsig.py", {}, false);
  ```
- Updated `deployer.deployApp(...)` & `deployer.updateApp(...)` to take one more optional parameter: `appName`. This will also save in a checkpoint the compiled app by name.
- `deployer.updateApp()` and `runtime.updateApp` take one more optional argument: `scTmplParams: SCParams` to be compatible with `deployApp` and be able to use template parameters.
- Added new function `getAppByName(name: string)` to query checkpoint information by app name.
- Added `deployer.loadLogicFromCache` to load a logic signature from already compiled TEAL codes (stored in `artifacts/cache`, for eg during `deployer.fundLsig`). This avoid re-compilation (and passing `scTmplParams`) each time(s) user wants to load an lsig.
- Updated `TealDbg` method to load already compiled TEAL code from `artifacts/cache`. Compilation is forced only when a) TEAL is not cached OR b) `scInitParam` (template parameters) are passed with `tealFile`.
- Adding `@algo-builder/web.status.getAssetHolding` function which queries account asset holding.

### Infrastructure

- Updated private-net setup, sandbox & indexer scripts to run in `dev` mode.

### Breaking changes

`@algo-builder/runtime`:

- Renamed `Runtime.getLogicSig` to `Runtime.createLsigAccount` #506.
- `runtime.addAsset(..)`, `runtime.addApp(..)` return a tx receipt object, which contains the newly created appID/assetID.

  - Migration: Example code:

  ```js
  // from
  const appID = runtime.addApp(flags, {}, approvalProgram, clearProgram);

  // to
  const receipt = runtime.addApp(flags, {}, approvalProgram, clearProgram);
  const appID = receipt.appID;
  ```

- `getProgram` is moved to `@algo-builder/runtime` from `@algo-builder/algob`.
- `runtime.addAsset`, `runtime.addAssetDef` and `runtime.addApp` are deprecated.
  Please use `runtime.deployASA`, `runtime.deployASADef` and `runtime.deployAdd` instead of the above functions.
- Update `runtime.deloyApp` to be compatible with `deployer.deployApp`.
- `balanceOf` in `@algo-builder/algob` package now return amount (number) of asset account holding and won't print them. If the account does not hold an asset it will return 0. To query asset holding, please use a new `@algo-builder/web.status.getAssetHolding` function.
- Updated `deployer.deployApp` to pass `scTmplParams` (smart contract template parameters).

### Bug Fixes

- Fix bug substring3 opcode pop wrong order [/#505](https://github.com/scale-it/algo-builder/pull/505), contribution: @vuvth.
- Fix bug: `runtime.optinToApp` updating state even after opt-in fails. Reported by @patrick

## v2.1.0 2021-10-22

### Features

- Upgrade indexer version
- TEALv5 support (part1) in `@algo-builder/runtime`:
  - Ecdsa opcodes: ecdsa_verify, ecdsa_pk_decompress, ecdsa_pk_recover
- Update Algorand indexer to v2.6.4
- `@algo-builder/runtime` support return smart-contract return values in Interpreter. Credits: Ashley Davis
- Upgrade Algorand JS-SDK to v1.12

### Bug Fixes

- `@algo-builder/runtime`: `runtime.optInToApp` should throw error if an account is already opted-in to the App.
- Fix `ALGORAND_DATA` environment variable use and documentation.
- `@algo-builder/runtime`: Accept ASA deployment with total supply == 0

## v2.0.1 2021-10-18

### Bug Fixes

- [web] Fixed `metadataHash` attribute verification for `ASADefSchema` and consequently `deployASA` and updated the [`ASADef`](https://algobuilder.dev/api/web/modules/types.html#ASADef).

### Examples

- [examples/asa] Added more in `0-gold-asa.js` script we added an example how to correctly provide `metadataHash` for an ASA.

## v2.0.0 2021-09-30

### Features

- Added shared space between contracts
- Added tealv4 opcodes (`gload` and `gloads`)
- Added Tealv4 opcodes (`callsub` and `retsub`)
- Added loop support in runtime
- TEALv4 support in `@algo-builder/runtime`:
  - Added shared space between contracts (opcodes `gload` and `gloads`)
  - Dynamic Opcode Cost Evaluation
  - Transaction Array changes
    a) array length assertions for `tx.ForeignAssets`, `tx.Accounts`, `tx.ForeignApps`,
    b) User can pass id/offset for app/asset in for array references. For `tx.Accounts` you can pass address directly in teal code.
  - Byteslice arithmetic ops (`b+`, `b-`, `b*`, `b/`, `b%`, `b<`, `b>`, `b<=`, `b>=`, `b==`, `b!=`, `b\`, `b&`, `b^`, `b~`, `bzero`).
  - Additional mathematical opcodes: `divmodw`, `exp`, `expw`, `shl`, `shr`, `sqrt`
  - More Versatile Global and Local Storage (combination of upto 128 bytes allowed between key-value).
  - Asset URL change (max size increased till 96 bytes).
  - gaid, gaids opcodes (knowable creatable id)
- Updated all examples & tests to use TEALv4 (`#pragma version 4`)
- Added support for querying indexer in an `algob` script (accessable via `deployer.indexerClient`). You can pass `indexerCfg` in your network's config in `algob.config.js`. Added docs.
- Add function to store checkpoint for contract logic signature (`mkContractLsig`).
- Add support for algosdk.Transaction object in executeTranasction
- Add `signTransactions` functions: It signs transaction object(s) and returns raw signed transaction.

### Bug Fixes

- Fixed `yarn add @algo-builder/web` (was failing because of missing dependency `zod` in packages/web).
- Fix metadatahash type
- Fix init project-name bug(`algob init <project-name>` command was not working properly)
- Fix zod package was missing from runtime(but zod was being used in runtime)
- Added support for passing http token as an `object` as well. User can now use `{ "X-Algo-API-Token": <token> }` notation for passing token in `algob.config.js`.

### Testing framework bug fixes

- Fix random address for logic sig, creating two times an lsig account from the same TEAL code should return the same address.

### API Breaking

- Migrate from `LogicSig` to `LogicSigAccount`(Note: Loading lsig from file uses `LogicSig`, because `goal` stores it in LogicSig type format)
- Rename `CallNoOpSSC` to `CallApp`.
- Rename `optInAcountToASA` to `optInAccountToASA` (typo)
- Rename `readLocalStateSSC` to `readAppLocalState`, `readGlobalStateSSC` to `readAppGlobalState`.

### Dependencies

- Upgraded pyTEAL version [`0.9.0`](https://github.com/algorand/pyteal/releases/tag/v0.9.0) in pipfile.
- Upgraded indexer binary version to `2.6.1` in `/infrastructure/Makefile`.

### Examples

- Added new template [DAO](/examples/dao), with flow tests. Read the specification [here](https://paper.dropbox.com/doc/Algo-DAO--BTR~tKj8P788NMZqnVfKwS7BAg-ncLdytuFa7EJrRerIASSl).

## v1.2.1 2021-09-15

### Bug Fixes

- Fix `algob init <project-name>`.

## v1.2.0 2021-08-09

### Features

- Moved [error](http://algobuilder.dev/api/runtime/modules/errors.html) lists, BuilderError, [mkTransaction](http://algobuilder.dev/api/runtime/modules.html#mktransaction) to `@algo-builder/web` package. Re export `mkTransaction`, `errors` in algob and runtime from `@algo-builder/web` for backward compatibility.
- Added `algob init --typescript` flag to initialize a typescript project. Usage: `algob init <location> --typescript`.
- Support pooled transaction fees in algob and runtime - now one transaction can pay for other transaction fees in a group.
- Added `flatFee` to `TxParams`.
- Added support for teal debugger (get dryrun response or start debugger using `tealdbg` in chrome) in `algob` scripts.
- User can initialize & use accounts by name in `@algo-builder/runtime`, similar to algob ('john', 'bob' etc)
- Updates to `algob sign-multisig`:
  - Creating a new multisigned transaction (requires multisig metadata: `v, thr, addrs`)
  - Support for signing in a group transaction (loaded from file).
  - Check usage in our [guide](http://algobuilder.dev/guide/sign-multisig.html)
- Added `deployASADef` function to deploy ASA without using `/assets/asa.yaml`.
- Added `yarn run test:watch` command. NOTE: it will spawn multiple process in the same terminal session. So if you want to stop the all processes the best solution is to kill the terminal session.

- Added new package `@algo-builder/web`. It can be used in Dapps to interact with ASAs and Stateful applications. Main features:
  - Compatible with [`algosigner`](https://github.com/PureStake/algosigner).
  - Support algob's high level function:`executeTransaction` in a webapp as well (note: currently `deployASA` & `deployApp` transactions are not supported, as we don't load data from checkpoints OR `/assets`).
  - Support group transactions.
  - The `executeTransaction` takes transactions parameters (single/group) as input, triggers an algosigner prompt for signature, sends transaction to network and return it's response. Documentation can be found [here](https://github.com/scale-it/algo-builder/tree/develop/packages/web#algo-builderweb).

### Dapp templates and solutions

- Added new template [`/shop`](https://github.com/scale-it/algo-builder-templates/tree/master/shop) to demonstrate a react component (payment widget) to make a purchase and trigger `AlgoSigner` for signing a transaction.

Examples

- [Permissioned Token](/examples/permissioned-token) Added `cease` function and a script to change permissions app_id.

Tutorials:

- We published a Securities and Permissioned Tokens solution (implemeted using `algob`): [https://developer.algorand.org/solutions/securities-and-permissioned-tokens/](https://developer.algorand.org/solutions/securities-and-permissioned-tokens/).
- Published fifth tutorial in the `@algo-builder` series, on how to use `algob console` to quickly and easily interact with ASA and smart contracts: [https://developer.algorand.org/tutorials/algo-builder-tutorial-part-5-algob-console/](https://developer.algorand.org/tutorials/algo-builder-tutorial-part-5-algob-console/).

### Quality Assurance

- Added github workflows/examples.yaml to execute [`/examples`](https://github.com/scale-it/algo-builder/tree/master/examples) on a private net, on pushing new commit to `develop`/`master` branch OR creating a pull request that target these branches.

### Infrastructure

- Added new make commands:
  - `setup-reach` - sets up reach executable file in `~/.algorand-reach` directory
  - `remove-reach` - halts any dockerized devnets, kills & removes docker instances and containers, remove reach bash file from `~/.algorand-reach`.
  - `restart-private-net`: restarts private-net.
  - `indexer-docker-up`, `indexer-docker-down`: Docker based setup for indexer. Runs in read-only mode, without connecting to local algod node.
  - `make setup-postgresql`: Install `postgresql` database on a local linux system and setup a new user & database.
  - `make start-indexer`: Add local indexer binary (downloaded in `~/.algorand-indexer-download`) and start the indexer by connecting to database and local algod node.
  - `make recreate-indexer`: resets the indexer database and runs `start-indexer`.
  - `make remove-indexer`: Removes `~/.algorand-indexer-download` directory from system.

### API breaking

- Rename `SSC` to `App` - This will affect deployment and all calls made to stateful smart contracts(SSC) or `App`
  - OptInSSC -> OptInToASA
  - DeleteSSC -> DeleteApp
  - DeploySSC -> DeployApp
  - SSCDeploymentFlags -> AppDeploymentFlags
  - SSCOptionalFlags -> AppOptionalFlags
- Import are changed to scoped imports
  - instead of stringToBytes, you can import a `convert` namespace (from `@algo-builder/algob`), and then use `convert.stringToBytes`
- Types imports for `ExecParams`, `TransactionTypes`, `SignType` moved to new package `@algo-builder/web`
- Migrate to algorand/js-sdk types from `@algo-builder/types-algosdk`.

### Bug fixes

- Fixed dependency [issues](https://github.com/scale-it/algo-builder/issues/433) while installing algob using `yarn add @algo-builder/algob` & `npm install @algo-builder/algob`.
- `web`:
  - Added missing `fromAccount?` attribute to the `Sign` type.
  - Remove TxParams type from runtime package(it is duplicated in runtime)

## v1.1.1 2021-07-12

### Bug fixes

`@algorand-builder/runtime` \* [\#409](https://github.com/scale-it/algo-builder/issues/409) Added missing `fromAccount` attribute to `SignWithLsig` type.

## v1.1.1 2021-07-12

### Features

- updated `algob test` command to run mocha in typescript project as well.

### Bug fixes

`@algorand-builder/runtime` \* fixed [bug](https://github.com/scale-it/algo-builder/issues/404) when trying to optIn to asset using asset transfer transaction with amount 0n.

## v1.1.1 2021-07-12

### Features

- Updated `algob test` command to run mocha in typescript project as well.

### Bug fixes

`@algorand-builder/runtime`

- fixed [bug](https://github.com/scale-it/algo-builder/issues/404) when trying to optIn to asset using asset transfer transaction with amount 0n.

## v1.1.0 2021-06-23

Highlights:

- TEALv3 support
- improved documentation and guide
- better handling in `executeTransaction`
- checkpoint can be market invalid if they are substituted (eg by redeploying same asset).

### API breaking

- Move `updateApp` function to `deployer`

* Rename `parseArgs` to `parse_params`

* For External support of parameters user should replace TMPL\_ prefix in their smart contracts, and only use it when using pyteal.tmpl(..)
* Rename `appId` to `appID` in all places. (previously some of SSC params were taking `appId` and other were taking `appID`, this was inconsistent)

### Features

- Replaced dependency `find-up` with `findup-sync` in `algob`.
- Added `algopy` in `@algo-builder/algob/sample-project`, which enables users to pass template parameters to PyTEAL contracts. Updated docs.
- Store checkpoints in nested form for SSC, added tests.
- Added support for sub directories in assets folder, with tests.
- Update runtime to process execParams.deployASA, deployApp, OptInToASA, OptIntoSSC
- Exported `@algorand-builder/algob`, `@algorand-builder/runtime` error types and make it accessible for API documentation.
- Added `debugStack` option in `runtime.executeTx()` to print stack (upto depth = debugStack) after each opcode execution.
- TEALv3 support in `@algo-builder/runtime`.
- Transpile TEAL code to substitute the TMPL placeholders
- Mark not valid checkpoints (in case of `deleteApp`/`DestroyAsset`) using `deleted` boolean

### Bug fixes

`@algorand-builder/runtime`
_ Remove asset holding from account if `closeRemainderTo` is specified.
_ Asset creator should not be able to close it's holding to another account.

- fixed temporal files handling.

## v1.0.2 2021-05-18

### Features

- Update how error is displayed to a user
- Add Update stateful smart contracts using execute transaction in runtime

Runtime:

- added `updateApp` method.

### Bug fixes

- Added missing dependency: `find-up`

## v1.0.1 2021-05-16

- Fixed dependency for `@algo-builder/algob`.

## v1.0 2021-05-14

New website: https://scale-it.github.io/algo-builder

### API breaking

- Removed Algob prefix in deployer (eg. renamed `AlgobDeployer` to `Deployer`)
- Updated `execParams` structure & typings (input parameters for `executeTransaction`)
  - Migration: If `SignType` is `LogicSignature` then change `fromAccount` to `fromAccountAddr` and just pass from address instead of complete account.
- Changed the way we pass arguments to stateless smart contract - moved assignment from when we load smart contract (using `loadLogic`, `mkDelegatedLsig`, `fundLsig`) to when we create transaction execution parameters.
  - Migration: assign stateless args in txParams to `executeTransaction`. Eg
    ```js
    await deployer.loadLogic('htlc.py', [arg1]); // remove scTmplParams from here
    const txnParams: rtypes.AlgoTransferParam = { .. }
    txnParams.args = [arg1]; // assign here now
    await executeTransaction(deployer, txnParams);
    ```

### Features

- Added more tests for the [crowdfunding example project](/examples/crowdfunding) using `@algo-builder/runtime`- Happy paths and Failing paths.
- Integrated user documentation with `jekyll`.
- Added new function `signLogicSigMultiSig` to sign logic signature by multisig.
- Updated ASA deployment (`deployASA` function) to pass custom params and save deployed asset definition in checkpoint.
- Support deployment and optIn methods in a transaction group (along with all other methods, using `executeTransaction`).
- Renamed `loadBinaryMultiSig` to `loadBinaryLsig` (load signed logic signature from file in scripts).
- New opt-in functions and updates. Check the [deployer API](https://scale-it.github.io/algo-builder/api/algob/interfaces/types.deployer.html) for information about all opt-in functions.
  - `deployer.optIn` are now available both in _DEPLOY_ mode to _RUN_ mode.
  - Extended `deployer.optIn*` functions to support ASA by ID. Previously we only accepted ASA by name (based on the name in `assets/asa.yaml` file).
  - Added [`deployer.optInLsigToApp`](https://scale-it.github.io/algo-builder/api/algob/interfaces/types.deployer.html#optinlsigtoapp) and [`deployer.optInLsigToASA`](https://scale-it.github.io/algo-builder/api/algob/interfaces/types.deployer.html#optinlsigtoasa) to easily opt-in stateless smart contract (lsig) account to stateful smart contract and ASA.
- Asset related `execParams` (transaction parameters for [`executeTransaction`](https://scale-it.github.io/algo-builder/api/algob/modules.html#executetransaction)) support ASA by name and by ID (previously only ASA ID was supported). [Example](https://github.com/scale-it/algo-builder/blob/master/examples/asa/scripts/transfer/gold-delegated-lsig.js#L22).
- cleaned test suite log (when developing Algo Builder itself). Our test suite has 884 tests.

### Commands

We added new commands:

- `algob test` (runs mocha in project root).
- `algob unbox-template <name> <destination>` to quickly unbox a dapp template from `scale-it/algo-builder-templates`.
- `algob sign-multisig --account <acc> --file <input> --out <out-file>` to append user's signature to signed multisig file using accounts managed by `algob`.
- `algob sign-lsig --account <acc> --file <input> --out <out-file>` to sign logic signature using accounts managed by `algob`.

### Examples

- Added new templates:
  - [Permissioned Token](/examples/permissioned-token)
  - [stateful counter](/examples/stateful-counter)
- Updated [`examples/asa`](/examples/asa): added new use-case to deploy and control ASA by a smart contract.

### Dapp templates.

- We created a new [repository](https://github.com/scale-it/algo-builder-templates) with dapp templates. It's a new project line of Algo Builder. Dapp Templates are webapps operating with Algorand blockchain with `algob` support. For the moment we only have React templates. Anyone can contribute with a new template or by improving the pre-existing ones by creating a pull request.
  - [/default](https://github.com/scale-it/algo-builder-templates/tree/master/default) template (with ASA transfer functionality)
  - [/htlc](https://github.com/scale-it/algo-builder-templates/tree/master/htlc) template - dapp implementing hash time locked contract.
- Added `algob unbox-template` command to download a template and setup the project.

### Infrastructure

- Added new make commands:
  - `setup-private-net` - creates and starts private network, setups master account and shows network status.
  - `recreate-private-net` - stops and removes the private network, and re-setup.

### @algorand-builder/runtime:

- fixed bugs
  - in group tx flow
  - in opcodes: _asset_params_get_, _txn GroupIndex_, _concat_
  - closing asset using clawback should be denied

## v0.5.4 2021-03-15

Renaming the organization and package names to `@algo-builder`.

## v0.5.0 2021-03-08

General:

- Added documentation (in `/docs/testing-teal.md`) to test TEAL using `@algorand-builder/runtime`
- [breaking] Added support for ASA OptIn for contract account (eg. escrow) represented by logic signature. Changed `optInToASA` to `optInAcountToASA` (for optIn using account) and `optInLsigToASA` (for optIn using logic signature account).
- Use `bigint` for all numeric values in `runtime` and `algob` to support integers upto 64 bit(`uint64`).

@algorand-builder/runtime:

- Full support for asset related transaction (create, opt-in, transfer, modify, freeze, revoke, destroy)
- Support for group transactions

Infrastructure:

- Support Sandbox in `/infrastructure` to quickly set up the private net
- [breaking] Changed default network config and the private-net for compatibility with Sandbox:
  - port = 4001
  - token = aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
- Updated the default token and endpoint port. For compatibility with Sandbox we use the sandbox token and port (4001) in all examples and sample project. If you run an algorand node using our private node setup then either recreate the network (stop, remove node_data and create it again), or update the `node_data/PrimaryNode/config.json` and set: `"EndpointAddress": "127.0.0.1:4001"`

## v0.4.0 2021-02-03

- Renamed `@algorand-builder/algorand-js` to `@algorand-builder/runtime`
- Added new example project - Crowdfunding Application
- `@algorand-builder/runtime`: added support for transactions: payment, app creation, opt-in, stateful (application call, clear, delete, close).
- Added support for arguments in stateful smart contracts similar to goal (eg. `str:abc`, 'int:12')
- Logic signature validation for stateless teal in runtime
- Introduced versioning of TEAL opcodes in runtime with max cost assertion
- Added a Typescript example project - `htlc-pyteal-ts`

## v0.3.0 2020-12-28

Moved package into `@algorand-builder` NPM organization. So all imports and install commands require to change `algob` to `@algorand-builder/algob`.

- Reproducible, declarative Algorand Network setup using scripts in `/infrastructure`.
- Re-organized examples. Now all examples share same config. Users are able to provide their own
- We ported all developer.algorand reference templates
- Reworked smart contract handling.
- API documentation improvements
- Added lot of new TypeScript [typings](https://github.com/scale-it/algorand-builder/tree/master/packages/types-algosdk) for `algosdk-js`

## v0.2.0 2020-11-25

- As a user I can compile and run PyTeal Files
- As a user I can access accounts from an ENV variable
- As a user I can load ALGOD and KMD credentials from ENV variable
- As a user I can load a multisig directly from /assets and execute transactions
- As a user I can use CLI to run an JS Node REPL with async/await suppport on the top level

### Breaking Changes

- `Deployer` smart-contracts API changes. Please refer to our [API documentation](https://scale-it.github.io/algorand-builder/interfaces/_types_.algobdeployer.html) to check available functions and attributes.

## v0.1 2020-09
