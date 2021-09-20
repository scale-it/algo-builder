## Requirements

- Good knowledge about Blockchain and Algorand.
- Detailed introduction to algob
- Detailed knowledge about assets, accounts, transactions and signatures.
- Detailed knowledge about statless and stateful algorand smart contracts.

## Algorand bond token

Bonds are units of corporate debt issued by companies and securitized as tradeable assets. A bond is referred to as a fixed-income instrument since bonds traditionally paid a fixed interest rate (coupon) to debt holders. Variable or floating interest rates are also now quite common. Bond prices are inversely correlated with interest rates: when rates go up, bond prices fall and vice-versa. 

## Use Cases

We use functional notation to describe use cases we will implement.

- `issue(amount)` — issue new bonds to the issuer account.
- `burn(amount)` — issuer can burn unsold bonds.
- `buy(amount)`  — investor will buy bond from the issuer account by paying 
        `amount×issue_price` (in ALGO).
- `exchange(price, amount)` — group of transactions including a buyer transaction paying amount×price of ALGO to the seller (signed by buyer), and seller transaction sending amount of bonds to the buyer (signed by seller). 
- `transfer(amount, recipient)` — bond holder can transfer amount of bonds to someone else.
- `exit(amount)`  — after maturity bond holder can send bonds back to the issuer and receive `amount×nominal_price`  back. Issuer must provide enough funds to the issuer account upon the maturity date. Otherwise a legal consequences can be triggered.
- `redeem_coupon()`  — bond holder can get his interest (in ALGO).

Note: In this example we have constant `coupon_value` for all the epochs, we can make variable by having this value hardcoded in each `DEX_i`.

## Design Overview

Requirements

- We will use ASA to represent a bond. The advantage of  this is that we will use all standard tooling to track ASA and represent bond as an asset in a standard algorand way.

The solution consist of:

- `BondDapp` - a stateful smart contract which will store the bond parameters: issue price, nominal price, maturity date. Additionally, the App will store a reference to the currently tradeable bond ASA and the current epoch number.
- `epoch` — stored in the `BondDApp` is the current period for paying the coupon. For example: When bond coupons are paid every 6 month, then initially the epoch is 0. After 6 months bond holders receive a coupon for interest payment and start epoch 1. After another 6 months bond holders receive a new coupon for interest payment and we start epoch 2…
- We bundle coupons with bonds in a single token - Bond token (ASA). 
    - There is a different ASA for each epoch: in a single `BondDApp` we define family of Bond tokens: `B_0`, `B_1`, `B_2` , … `B_n` .  `B_i` token represent a bond which received a coupon payment at `i-1` epoch but execute a coupon payment at `i` epoch.
    - Holder of `B_i` token can redeem his token and get coupon payment using DEX lsigs (see below)
- Set of logical signatures (stateless contracts): `DEX_0`, `DEX_1` ….
    - `B_i` holder can exchange tokens with `DEX_i` for equal number of `B_{i+1}` tokens and `coupon_value` of ALGOs only when `i < BondApp.epoch`. For example: At epoch 2, user X owns 10 `B_1`  tokens. He can send his tokens to `DEX_1` and in exchange of 10 `B_2` tokens and `10 × BondApp.coupon_value` of ALGOs. NOTE: at epoch 2, user can exchange his `B_0` tokens with `DEX_0` if he didn’t do it yet.
    -  `B_i` tokens sent to `DEX_i` are locked forever. 
    - Issuer must create and supply ALGO to `DEX_i` in advance. Otherwise legal consequences can be triggered.

## Spec document

App template [specification](https://paper.dropbox.com/doc/Algorand-Bond-Template--BOU8bTQSnmRNk23KK8McWwxXAg-hzI7C681Soo2sr6iyGFzg).

## Implementation

```
algob project:
├── algob.config.js
├── assets
│   ├── asa.yaml
│   ├── bond-dapp-clear.py
│   ├── bond-dapp-stateful.py
│   ├── buyback-lsig.py
│   ├── dex-lsig.py
│   └── issuer-lsig.py
├── package.json
├── README.md
├── scripts
│   ├── deploy.js
│   └── run
│       ├── common
│       │   ├── accounts.js
│       │   └── common.js
│       ├── createBuyback.js
│       ├── createDex.js
│       ├── epoch0.js
│       ├── epoch1.js
│       ├── exit.js
│       ├── issue.js
│       ├── redeem.js
│       └── run.js
└── test
    ├── bond-token-flow.js
    ├── common
    │   └── common.js
    └── failing-tests.js
```

## Token

The token should provide all information about the bond token and the underlying security. Token is an Algorand Standard Asset defined in assets/asa.yaml. ASA fields worth to mention:

- `unitName`: Name to denote bond token
- `url`: It must link to the document specifying all legally required information as well as metadata (information about tokens, distribution description, code repository ..etc). The document should be immutable. The document can be encrypted. We recommend storing the document in IPFS.
- `metadataHash`: is a `blake2b` hash of the document linked by `url`. If the document is encrypted,the hash should be computed from the unencrypted version.
- `total`: amount must envision all future needs and legally specified. In Algorand, all tokens must be created at the beginning and they will be stored the a reserve address. The process of distributing new tokens is done by creating a new supply from the tokens stored in the reserve address.
- `reserve`: An account (key or lsig) which keeps all possible token supply. We recommend to use multisig key or lsig (logic signature).

## Smart Contracts

We will implement the following smart contracts:

  - `bond-dapp-stateful.py`: A stateful smart contract which will store the bond parameters with rules described above.
  - `issuer-lsig.py`: A stateless contract which will be used to issue bond tokens.
  - `dex-lsig.py`: A stateless contract which will be used to exchange (i-1) tokens if epoch i is completed.
  - `buyback-lsig.py`: A stateless contract which will be used to buyback bond tokens once maturity period is over.
  - `bond-dapp-clear.py`: clears app state (returns 1)

## Setup

1. Creator account creates initial bond tokens.
2. Creator account creates `bond-dapp` stateful contract with `manager address`.
3. Issuer logic signature is loaded with `bond-dapp-id`, `manager-account` and `creator-account`.
4. Manager Opt-in `bond token 0` to issuer address(Only app manager can opt-in issueer lsig to ASA)
5. Manager updates the issuer address in `bond-dapp`.

All operations above are implemented in deployment script `scripts/deploy.js`.

Below we will describe in details each deployment procedure:

## Deploy Bond token (ASA)

We will use deployer object available in algob scripts:
```js
// Create B_0 - Bond Token
const asaInfo = await deployer.deployASA('bond-token-0', { creator: creatorAccount });
console.log(asaInfo);
```

## Deploy bond-dapp stateful contract

Bond deployment script:
```js
// Bond-Dapp initialization parameters
const appManager = convert.addressToPk(managerAcc.addr);
const issuePrice = 'int:1000';
const couponValue = 'int:20';
const currentBond = convert.uint64ToBigEndian(asaInfo.assetIndex);
const asset = await deployer.getAssetByID(asaInfo.assetIndex);
const maxIssuance = convert.uint64ToBigEndian(asset.params.total);
const creator = convert.addressToPk(creatorAccount.addr);

let appArgs = [
  appManager,
  creator,
  issuePrice,
  couponValue,
  currentBond,
  maxIssuance
];
const placeholderParam = {
  TMPL_NOMINAL_PRICE: 1000,
  TMPL_MATURITY_DATE: Math.round(new Date().getTime() / 1000) + 240
};
// Create Application
const bondAppInfo = await deployer.deployApp(
  'bond-dapp-stateful.py',
  'bond-dapp-clear.py', {
    sender: managerAcc,
    localInts: 1,
    localBytes: 1,
    globalInts: 8,
    globalBytes: 15,
    appArgs: appArgs
  }, {}, placeholderParam);
console.log(bondAppInfo);
```

## Setup issuer lsig

Here we will use bond-dapp-id received from previous deployment
```js
// Initialize issuer lsig with bond-app ID
const scInitParam = {
  TMPL_APPLICATION_ID: bondAppInfo.appID,
  TMPL_OWNER: creatorAccount.addr,
  TMPL_APP_MANAGER: managerAcc.addr
};
const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);
```

## Opt-In issuer lsig to ASA(can only be done by manager)

```js
// Only app manager can opt-in issueer lsig to ASA
await optInTx(deployer, managerAcc, issuerLsig, asaInfo.assetIndex);
```

Note: We have added helper function for opting in issuer to ASA, this function has group transaction which ensures only manager can opt-in lsig to ASA.

## Update Issuer address in bond-Dapp(can only be done by manager)

```js
// update issuer address in bond-dapp
appArgs = [
  'str:update_issuer_address',
  convert.addressToPk(issuerLsig.address())
];

const appCallParams = {
  type: types.TransactionType.CallApp,
  sign: types.SignType.SecretKey,
  fromAccount: managerAcc,
  appID: bondAppInfo.appID,
  payFlags: {},
  appArgs: appArgs
};
await executeTransaction(deployer, appCallParams);
```

## Interaction script

In `scripts/run` folder we have scripts with the following files:

 - `run/run.js`: It controls all the scripts and maintain order of execution.
 - `run/issue.js`: This is first script, in this script tokens are issued to issuer from token creator.
 - `run/epoch0.js`: In this script, `elon` buys 10 bond tokens and sell 2 bond tokens to `bob` for 2020 Algos.
 - `run/createDex.js`: This script creates i-th Dex, burns `B_i` bond tokens, issues `B_i+1` bond tokens.
 - `run/redeem.js`: This script exchanges tokens and redeems coupon.
 - `run/epoch1.js`: `elon` redeems 8 bond tokens and buys 4 more from dex.
 - `run/createBuyback.js`: Creates a buyback logic signature address.
 - `run/exit.js`: Buyer can exit their bond tokens using this script.
 - `run/common/accounts.js`: Loads accounts
 - `run/common/common.js`: contains common functions and constants.
 
 - In a run script example we present the following scenario:
    - Issue initial bond tokens to the issuer
    - In epoch_0 elon buys 10 bonds
    - In epoch 0 elon sells 2 bonds to bob for 2020 ALGO (in a group transaction)
    - Manager creates dex 1
    - Elon redeems his bonds (8), Elon buys 4 more bonds (so he will have 12 bonds in total)
    - Manager creates dex 2
    - Elon redeems all his bonds.
    - Bob redeems his bonds from epoch 0 and 1
    - Maturity period is set to 240 seconds(4 min) after the contract deployment. At maturity, manager creates and funds buyback and both elon and bob can exit all their tokens (12 and 2 respectively).

## Helper functions

In `scripts/run/common/common.js` we have helper functions for making group transactions.
Following functions are present in this file:

- `optInTx`: Returns optIn transaction for opting in to a logic signature
- `buyTx`: Returns group transaction to buy tokens
- `issueTx`: Returns group transaction for issuing bonds to issuer
- `createDexTx`: Returns group transaction for creating dex
- `redeemCouponTx`: Returns group transaction for redeeming bonds

## Tests

Tests using @algo-builder/runtime are also added. An example test is described below.

```js
it("Random user should not be able to update issuer's address", () => {
  // update application with correct issuer account address
  const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)]; // converts algorand address to Uint8Array

  const appCallParams = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: randomUser.account,
    appID: applicationId,
    payFlags: {},
    appArgs: appArgs
  };

  assert.throws(() => runtime.executeTx(appCallParams), RUNTIME_ERR1009);
});
```
Only manager should be able to update issuer address.

More tests(happy and failing paths) can be found [here]().