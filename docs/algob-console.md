# Algob Console

Sometimes it's nice to work with your contracts interactively for testing and debugging purposes, getting network config, paths, or for executing transactions by hand. 

`algob` provides you an easy way to do this via an interactive console, with your contracts available and ready to use.

## Usage

* To open console session run `yarn run algob console`
* To select network add `--network networkName` in command.(eg. `yarn run algob console --network localhost`)
* To exit `algob console` type `.exit`, `ctrl + D` or `ctrl + C` (twice). 

## Globals

Following globals are available in an `algob console` REPL:
* `deployer` : algob deployer in run mode. User can access checkpoints, get logic signature, transferAlgos and all other functions supported by `algob deployer`.
* `algodClient` : `algosdk.Algodv2`- an instance of algorand driver based on the current network (default if `--network` flag is not passed).
* `algosdk` : User can access `algosdk` package functions using this object. (eg. `algosdk.encodeAddress(..)`)  
* `algob` : all`algob` [exported](https://github.com/scale-it/algorand-builder/blob/master/packages/algob/src/index.ts) functions (eg. `algob.mkAccounts(..)`, `algob.balanceOf(..) etc)`

# Example Walkthrough

This section demonstrates a detailed walkthrough of executing `/scripts/transfer` functions in `examples/deployment` using `algob console`. The project used for this walkthrough is `examples/deployment` where user is able to 
* transfer `algos` between accounts
* transfer `assets` (eg. `gold`, `tesla`)
* transfer `algos` directly from smart contract(contract account) or by delegating authority.

using `algob console`.

## Setup

In the  `examples/deployment` directory:
1. Follow the README file
2. deploy the assets and smart contracts:
```
yarn run algob deploy
``` 
This will deploy your assets (`gold` and `tesla` in this case) and store asc1 `logic signature` in checkpoint for delegated approval mode. Also, let's initialize some of the accounts which we will use in further transactions. 

Open a console session and initialize `master account` using `deployer` object
```
masterAccount = deployer.accountsByName.get("master-account")
``` 
![image](https://user-images.githubusercontent.com/33264364/97816308-735e8080-1cba-11eb-970d-50f8e3217d8f.png)

Similarly, initialize few more accounts as well (check `algob.config.js` for more info regarding these example accounts)
```
goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
johnAccount = deployer.accountsByName.get("john-account");
bobAccount = deployer.accountsByName.get("bob-account");
```

Let us now execute some transactions.

## Transfer Algos

Here, we will transfer `1 Algos` from `masterAccount` to `johnAccount` using `transferMicroAlgos` function present within `algob` context (`algob.transferMicroAlgos(..)`). Code can be found in `/scrips/transfer/master-fund-john.js`.

```
await algob.transferMicroAlgos(deployer, masterAccount, johnAccount.addr, 1000000, {note: "ALGO PAID"})
```
![image](https://user-images.githubusercontent.com/33264364/97816714-08627900-1cbd-11eb-86db-1dffbceb125f.png)

## Transfer Assets

We will transfer a single unit of Algorand Standard Asset `gold`(which we deployed during setup) from `goldOwnerAccount` to `johnAccount` using `transferAsset` function present within `algob` context (`algob.transferAsset(..)`). Code can be found in `/scrips/transfer/gold-to-john.js`.

```
goldAssetID = deployer.asa.get("gold").assetIndex
await algob.transferAsset(deployer, goldAssetID, goldOwnerAccount, johnAccount.addr, 1)
```
![image](https://user-images.githubusercontent.com/33264364/97816941-3e086180-1cbf-11eb-87f1-485bde49323c.png)

You can also check balance of `johnAccount` using `algob.balanceOf(..)`
```
await algob.balanceOf(deployer, johnAccount.addr, goldAssetID);
```

Similar example - `/scrips/transfer/tesla-to-john.js`

## Transfer Algos according to ASC logic (Contract Account)

Here we will transfer some `algos` from an algorand smart contract (`/assets/2-gold-contract-asc.teal`) to `johnAccount`. We will first load the logic signature (using `deployer.loadLogic(<file_name>.teal)` and get it's address(`lsig.address()`). This address will act as the sender(contract account mode) and receiver is `johnAccount`. Finally, we transfer some algos using `algob.transferMicroAlgosLsig(..)` function. Transaction will pass/fail according to asc logic.
```
lsig = await deployer.loadLogic("2-gold-contract-asc.teal");
sender = lsig.address(); 
```
![image](https://user-images.githubusercontent.com/33264364/97818537-e3740300-1cc8-11eb-81cd-a64e80106cf7.png)

```
#Transaction PASS (amount <= 100)
await algob.transferMicroAlgosLsig(deployer, { addr: sender}, johnAccount.addr, 20, lsig);

#Transaction FAIL (amount should be <= 100)
await algob.transferMicroAlgosLsig(deployer, { addr: sender}, johnAccount.addr, 200, lsig);
```

Code can be found in `/scripts/transfer/gold-contract-sc.js`

## Transfer Assets and Algos according to ASC (Delegated Approval)

Here, we will first transfer some Algorand Standard Assets(ASA) from `goldOwnerAccount` (delegating authority in this case) to `johnAccount` according to asc `/assets/4-gold-asa.teal`. `goldOwnerAccount` is the delegating authority as during deployment (`yarn run algob deploy`) the smart contract's logic signature was signed by this account (check `/scripts/2-gold-asc.js`). Logic signature (stored in checkpoint) is retrieved using `deployer.getDelegatedLsig('<file_name>.teal'`). Assets are transferred using `algob.transferASALsig(..)`.  

```
lsigGoldOwner = deployer.getDelegatedLsig('4-gold-asa.teal');
assetID =  deployer.asa.get("gold").assetIndex;
```

![image](https://user-images.githubusercontent.com/33264364/97819104-998d1c00-1ccc-11eb-8276-9a47a1a70f14.png)

```
#Transaction PASS (asset amount <= 1000)
await algob.transferASALsig(deployer, goldOwnerAccount, johnAccount.addr, 500, assetID, lsigGoldOwner);

#Transaction FAIL (asset amount should be <= 1000)
await algob.transferASALsig(deployer, goldOwnerAccount, johnAccount.addr, 1500, assetID, lsigGoldOwner);
```

Also we can transfer `algos` from `goldOwnerAccount` to other accounts (say `bobAccount`). This is similar to transaction examples mentioned in the above section.

```
logicSignature = deployer.getDelegatedLsig('3-gold-delegated-asc.teal');

# Transaction PASS (amount <= 100)
await algob.transferMicroAlgosLsig(deployer, goldOwnerAccount, bobAccount.addr, 58, logicSignature);

# Transaction FAIL (amount should be <= 100)
await algob.transferMicroAlgosLsig(deployer, goldOwnerAccount, bobAccount.addr, 580, logicSignature);
```  
Code can be found in `/scripts/transfer/gold-sc.js`

**All smart contracts used in these examples can be found in `/assets` folder**
