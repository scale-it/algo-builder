# Permissioned token

Permissioned tokens have a mechanism limiting the token usage based on additional requirements. Securities may use the permissioned token mechanism to define complex compliance requirements, such as investor whitelisting and transfer restrictions. For example, only a verified, KYCed users can exchange tokens.

Specifically, we implement various mechanisms for permissioned tokens to:
- Control the number of tokens minted for distribution and also allow flexibility for the administrator to issue more tokens in the future.
- Create whitelists of accounts who are approved to buy/hold the tokens.
- Support transfer restrictions (e.g., U.S. vs international).
- Manage lock-ups as needed to ensure there are no transfers before they're allowed.
- Implement new permission requirements that come up post-issuance, such as adding or removing investors to the whitelists or creating additional whitelists for new restrictions.
- Take confidence in the ability to remove restrictions in the future if transfers become open or unlimited.

We design a permissioned tokens with emphasis for shares and equity.

## Design Overview

We want to enforce permission checks for all token transfer between non-reserve accounts. We will use a stateless TEAL as a clawback, which will execute all transfers. So, if a user A wants to transfer tokens to a user B, (s)he will need to create a token transfer transaction with clawback lsig.
We implement a Permissioned Token template, which executes the following steps:

1. Create ASA
2. Distribute to initial users
3. Move remaining assets to `reserve` account to properly signal future asset issuance.
4. Freeze all assets OR create the asset default-frozen (clawback can still move frozen tokens).
5. Create following stateful smart contracts:
    + permissions (`P`) with rules and permission checks
    + controller (`C`) - which stores the `P` address.
6. Create a stateless teal (`clawback`) which will check that the C and P is called as well.
7. Update the clawback address to the contract `clawback`.
8. Whenever user A want's to transfer some tokens to B, he will need to combine this transaction with a clawback asset transfer transaction.
9. Clawback transfer ensures a call to the controller smart contract (`C`). Controller has the application id of permissions/rules smart contract (`P`), and hence ensures `P` is called as well.

### Smart Contracts

Smart contracts (in `/assets`):
- *clawback.py*: a stateless smart contract which will be responsible to dispatch permission checks and execute the payments. It's set to be the asset clawback address. Clawback logic ensures that during a token transfer between accounts, `controller` smart contract is called. `reserve` account is always allowed to transfer tokens to anyone (bypassing all permission checks). It also handles issuance transaction & update reserve account transaction.
- *controller.py*: `C` acts as a controller of the token - it ensures that during a token transfer, smart contract `P` is called and has an ability to update and use other permissions smart contract. If there are multiple permissions contracts, then the controller must ensure that all those contracts are called (it must store the app ids). `C` is also used to kill the token.
- *permissions.py*: This is the rules stateful smart contract. There can be many `permissions` smart contract implemented, and a controller can use more then one. The users have to opt-in to a smart-contract in order to let the contract store user data. The vision is that the permissions smart contracts are rather independent and shared between different permissioned ASA. It's worth noting that a permissions smart contract can require another smart contract call in the group.
  In this template we implement one permissions smart contract with two rules:
  - An account cannot hold more than 100 tokens
  - Both `from` and `to` accounts must be whitelisted
- *clear_state_program.py*: clears app state (returns 1)

`assets/asa.yaml` - This the the asset definition file.

### Setup

Deployment scripts are placed directly in `/scripts`:

**NOTE:** In a real world scenario, transactions involving a multisig account (eg. token can be created and issued by a multisig) will involve an interaction of many users. A user will receive a signed transaction or can create an unsigned transaction. User can sign the transaction using `algob sign-multisig` command or by using the `signMultiSig` function in a script. Once transaction is signed, we can use `executeSignedTxFromFile` function to successfully send transaction to network (eg. deploy token).

1. *0-setup-token.js*: In this script we deploy the token (as an Algorand Standard Asset) using `deployer.deployASA(..)` function. Check note above if creator is a multisig address.
2. *1-setup-controller.js*: In this script we deploy `controller.py` smart contract (which saves the hardcoded token_id as a template paramteter & sets kill_status to false by default). Only token manager can deploy this contract.
3. *2-asset-clawback.js*: Here we deploy the contract `clawback.py` and add some funds to it. In contract we save token_id, controller_app_id. After that we update the asset clawback to the address of the contract account (using algob ModifyAsset transaction)
4. *3-setup-permissions.js*: Here, we deploy the `permissions.py` smart contract, which has the rules. During permissions deployment, we save the perm_manager in the global state (while deploying it's passed as a template parameter, but it can be updated by the current permissions manager to another address as well)


### Other Solution

The solution in this template extends [Algorand Dev Office Hour](https://www.youtube.com/watch?v=aMDZamxtR14) idea presented by Jason - using asset clawback as escrow for permissioned token.
In this template we have a new contract - `controller.py` which essentially "controls" the asset/token. This controls the general properties of the asset and also ensures that rule(s) smart contract(s) are called.


## Use Case API

Below we describe different use cases implemented by the smart contract suite. We use a functional notation, along with description of transaction group which has to be created for each use-case. We implemented all use cases using functions in `scripts` directory. For direct integration in smart contracts, you need to construct transactions as described below.

#### Query

1. [*totalSupply(assetIndex)*](/examples/permissioned-token/scripts/common/common.js) -
   Returns total supply of the asset (`asset.total - balance_of(reserve)`).
1. [*balanceOf(holder)*](https://scale-it.github.io/algo-builder/api/algob/modules.html#balanceof) -
   Standard function in `algob`, use it to query `holder` balance of permissioned token (ASA).

#### User

1. [*transfer(fromAccount, toAddress, amount)*](/examples/permissioned-token/scripts/user/transfer.js) -
  Every transfer between non-reserve accounts has to pass permissions check to assure token compliance.
  Since all tokens are frozen, only clawback can transfer tokens. Since clawback is a stateless smart contract, a logic signature is required. The lsig validates the transfer only if the transfer transaction is accompanied with other transactions (it assures correct transaction group composition).
   A group of 4 (or more if there are more than 1 permissions contract) transactions is required:

   - *tx1*: Call to controller smart contract with  `app-arg = str:transfer` signed by *fromAccount* (asset sender).
   - *tx2*: ASA transfer transaction from sender to receiver using ASA clawback. The clawback contract ensures right contract composition.
   Asset clawback transaction from `fromAccount.address` to `toAddress`, amount = `amount`.
   - *tx3*: ALGO payment transaction to clawback to cover tx2 fee (`tx3.amount >= tx2.fee`). Anyone can make a payment.
   - *tx4*: Call to permissions smart contract to check required permissions, with `app-arg = str:transfer` and `app-accounts = [fromAccount.address, toAddress]`.

2.  [*optOut(account)*](/examples/permissioned-token/scripts/user/opt-out.js) -
    Standard ASA opt-out transaction: asset transfer transaction from `account.address` to itself, `amount = 0` and `closeRemainderTo = asset.creator`.
    **NOTE**: User opts out from the permissioned token. Algorand will transfer all his tokens to the ASA creator not the ASA reserve account (by definition of Algorand opt-out transaction).


#### Admin

1. [*issue(recipient, amount)*](/examples/permissioned-token/scripts/admin/issue.js) -
   Issuer can issue/mint tokens. In this implementation issuer is the reserve account. Recipient will need to opt-in to the token before the issuance. Since all tokens are frozen, similarly to `transfer` use case, a clawback lsig is required to transfer the tokens. Group of 2 transactions is required:
   - *tx1*: Call to controller smart contract with `application-arg = str:issue`, `foreign-asset = assetIndex`. Tx1 must be signed by the asset reserve account (`sender = reserve_account`).
   - *tx2*: ASA transfer from reserve to recipient using ASA clawback. `clawback.py` lsig does the basic sanity checks.

   We don't need additional rule checks as issuer sets the rules himself.

2. [*kill()*](/examples/permissioned-token/scripts/admin/kill.js) -
   Token manager can kill the ASA. If the ASA is killed then all issuance and token transfer transactions are rejected. User can only opt-out from the ASA to remove his holding and decrease his account's minimum balance.
   To kill ASA, we need to call controller smart contract with `app-arg = str:kill` and `foreign-asset = assetIndex`, Transaction must be signed by the asset manager. Controller updates the global state key: `is_token_killed = true`.

3. [*forceTransfer(fromAddress, toAddress, amount)*](/examples/permissioned-token/scripts/admin/force-transfer.js) -
   This is similar to the `transfer` use-case, but in this case the assets are being moved by asset manager, rather than a token holder. The transaction group is also similar to the `transfer` - the difference is that a call to `C`, `P` and paying for clawback lsgi fees is done by asset manager. Asset manager essentially represents clawback here (ceasing tokens from the `fromAccount`).
   Group of 4 transactions is required:
   - *tx1*: Call to controller smart contract with  `app-arg = str:force_transfer` and `foreign-asset = assetIndex`, signed by asset manager (asset sender).
   - *tx2*: Asset clawback transaction from `fromAddress` to `toAddress`, amount = `amount`. The clawback contract ensures right contract composition.
   - *tx3*: ALGO payment transaction to clawback to cover tx2 fee (`tx3.amount >= tx2.fee`). Anyone can make a payment
   - *tx4*: Call to permissions smart contract to check required permissions, with `app-arg = str:transfer` and `app-accounts = [fromAddress, toAddress]`.

    **NOTE**: *tx3*, *tx4* can be signed by anyone but they must be present in group (they validate conditions). The signer will pay transaction fees. If receiver of `forceTransfer` is the current asset reserve then the permissions smart contract call is not required.

4. *updateReserveByAssetConfig(newReserveAddress)* -
   If the _reserve account_ is a multisig address and we want to change the multisig signers, then we will need to update the asset reserve address. One approach is we update the asset reserve using *ModifyAsset* transaction, and move all tokens from previous reserve -> new reserve. This can be done in an atomic group transaction:

    - *tx1*: Call to controller smart contract with  `app-arg = str:force_transfer` and `foreign-asset = assetIndex`, signed by asset manager (asset sender).
    - *tx2*: Asset clawback transaction from `oldReserveAddress` to `newReserveAddress`, amount = `balance_of(reserve)` (moving all tokens to new reserve address).
    - *tx3*: ALGO payment transaction to clawback to cover tx2 fee (`tx3.amount >= tx2.fee`). Anyone can make a payment
    - *tx4*: Asset Config transaction updating reserve address to `newReserveAddress` - signed by asset manager.

    **NOTE**: Since *tx4* is an asset config transaction (updating reserve address), a permissions smart contract call is not required (as we're moving all tokens in *tx2* from old reserve to new one).

5. [*updateReserveByRekeying(newReserveAddress)*](/examples/permissioned-token/scripts/admin/update-reserve.js) -
   Standard rekey transaction for oldReserve account to `newReserveAddress` - signed by old reserve account. This way you won't need to move all tokens from old reserve to new reserve.

#### Permissions

1. [*whitelist(permissionsManager, userAddress)*](/examples/permissioned-token/scripts/permissions/whitelist.js) -
   Add a new user to the whitelist. Required to allow the user to receive or send tokens.

   * NoOp call to the permissions smart contract with `app-arg = str:add_whitelist` and `app-accounts = [userAddress]`. Must signed by *permissionsManager*.  If tx is successful, then permission smart contract updates `Txn.accounts[1]` (the `userAddress`) local state by setting `whitelisted = 1`.

2. [*changePermissionsManager(permissionsManager, newManagerAddress)*](/examples/permissioned-token/scripts/permissions/change-perm-manager.js) -
    Token manager can change the existing permissions manager via an application call to the controller smart contract (stored as `permission_manager` global variable).

    * NoOp call to the smart contract with `app-arg = str:change_permissions_manager` and `app-accounts = [newManagerAddress]`. Must be signed by the *old* permissions manager.


## References

Developer hour links:
- Developer Office Hours | Assets and Custom Transfer Logic Using Algorand Smart Contracts: [video](https://www.youtube.com/watch?v=aMDZamxtR14)
- [Assets and Custom Transfer Logic](https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/)
- *implementation of the solution above using algob*: [examples/permissioned-token-freezing](https://github.com/scale-it/algo-builder/tree/master/examples/permissioned-token-freezing)

Link to spec of current template: [https://paper.dropbox.com/doc/Algob-Security-Token-Template-FR2LXhVg3edevYPBQZw6F](https://paper.dropbox.com/doc/Algob-Security-Token-Template-FR2LXhVg3edevYPBQZw6F)
