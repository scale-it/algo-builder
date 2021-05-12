# Permissioned token

Permissioned tokens have a mechanism deciding who can use and hold tokens based on additional requirements. Securities may use the permissioned token mechanism to define complex compliance requirements, such as investor whitelisting and transfer restrictions. For example, only a verified, KYCed users can exchange tokens.

## Permissioned Token Motivation
Specifically, for Permissioned Tokens, we want to:
- Control the number of tokens minted for distribution and also allow flexibility for the administrator to issue more tokens in the future.
- Create whitelists of accounts who are approved to buy/hold the tokens.
- Support transfer restrictions (e.g., U.S. vs international).
- Manage lock-ups as needed to ensure there are no transfers before they're allowed.
- Process requirements or needs that come up post-issuance, such as adding or removing investors to the whitelists or creating additional whitelists for new restrictions.
- Take confidence in the ability to remove restrictions in the future if transfers become open or unlimited.
The permissioned token Template outlines a design of permissioned tokens with emphasis for shares and equity.

## Design Overview

We want to enforce permissioned checks on all token transfer between non-reserve accounts. We will use a stateless TEAL as a clawback, which will execute all transfers. So if user A wants to transfer to user B, (s)he will call a clawback stateless smart contract to transfer from account A to account B.
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

### Specification

Smart contracts (in `/assets`):
- *clawback.py*: a stateless smart contract which will be responsible to dispatch permission checks and execute the payments. It's set to be the asset clawback address. Clawback logic ensures that during a token transfer between accounts, `controller` smart contract is called. `reserve` account is always allowed to transfer tokens to anyone (bypassing all permission checks). It also handles issuance transaction & update reserve account transaction.
- *controller.py*: This stateful smart contract acts as a controller of the token. It ensures that during a token transfer, smart contract `P` (with rules and permissions) is called. If there are multiple rules contracts, then the controller must ensure that all those contracts are called (it must store the app ids). This smart contract can also be used to kill the token.
- *permissions.py*: This is the rules stateful smart contract. In this template we have two rules:
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
4. *3-setup-permissions.js*: Here, we deploy the `permissions.py` smart contract, which has the rules. During permisssions deployment, we save the perm_manager in the global state (while deploying it's passed as a template parameter, but it can be updated by the current permissions manager to another address as well)

### Execution

1. *Asset transfer* (`scripts/user/transfer.js`): A non-reserve account can hold few tokens (via issuance) and may wish to transfer some tokens to another non-reserve account. This should be in compliance with the permission smart contract `P` (`permissions.py`). For token transfer we need a group of at least 4 transactions (and more if there are more than 1 permissions contract):
a) call to controller smart contract (this ensures all rules are checked) - signed by asset_sender.
b) token transfer transaction from sender -> receiver using clawback (clawback contract ensures controller smart contract is called).
c) payment transaction from sender -> clawback (to cover tx fee of the transaction above)
d) call to permissions smart contract (to check rules: max token holding by receiver < 100, both from & to are whitelisted)

2. *Issuance* (`/scripts/admin/issue.js`): Issuer can issue/mint tokens. Receiver will need to opt-in to the token before the issuance. For issuance tx, we need a transaction group of:
a) Call to the controller smart contract - it checks if token is not killed (as issuance is not allowed if token is killed). It also verifies that the sender is the token reserve.
b) Asset transfer transaction from issuer -> receiver using clawback. `clawback.py` does the basic sanity checks for issuance_tx.
We don't need additional rule checks as issuer sets the rules himself.

3. *Forced Asset transfer* (`scripts/admin/force-transfer.js`): This is similar to asset transfer, but in this case the assets are being moved by asset manager, rather than a token holder. The transaction group is also similar to the one above. Difference is that a call to `C`, `P` and paying fees of escrow is done by asset manager. Asset manager essentially represents clawback here (revoking tokens from an account).

4. *Update Asset Reserve* (`/scripts/admin/update-reserve.js`): If the _reserve account_ is a multisig address and we want to kick out one address from the multisig, then we will need to update the asset reserve address. One approach is we update the asset reserve using *ModifyAsset* transaction, and move all tokens from previous reserve -> new reserve. This can be done in an atomic transaction group:
a) Force transfer all assets from previous reserve to new reserve - signed by asset manager (requires 3 txns, check Forced Asset Transfer above for more details)
b) Asset Modification transaction where we update the asset reserve address to new one. (requires 1 tx)
Another approach is to *rekey* ASA's Reserve account to the newReserve. This way you won't need to move all tokens from old reserve to new reserve. Now for transactions related to the asset reserve (eg. issuance), `fromAccountAddr` will be the old reserve address, but signing authority will be new reserve account.

5. *OptOut* (`/scripts/admin/opt-out.js`): User can optOut from the token if he wants to. This could be a simple asset transfer transaction from user -> creator (using user's sk) where asset_amount = 0 & close_remainder_to is asset creator. This tx will opt out a user from the token and transfer all his tokens to the asset creator.
NOTE: If asset creator and reserve are different address, then we will need to transfer all tokens from creator to reserve as well (to take those tokens out of circulation/increase total supply).

6. *Kill Token* (`scripts/admin/kill.js`): Token manager can kill the token. If the token is killed then all issuance and token transfer transactions are rejected. User can only opt-out from the token to remove his holding and decrease his account's minimum balance.
a) To kill the token, execute an application call tx to the controller smart contract with appArg: 'kill'. Only ASA mangager can do that. Controller updates the global state key (*is_token_killed*) to true.

7. *Whitelist User* (`scripts/permissions/whitelist.js`): Only a permissions manager (whose address is stored in the permissions smart contract's global state) can add a new user to the whitelist which enables that user to receive or send tokens.
For executing this tx, permissions manager calls the permissions smart contract with application arg "add_whitelist", and passes the account he wishes to whitelist in AppAccount array. If tx is successful, then permission smart contract updates the local state of `Txn.accounts[1]` & set *whitelisted = true (Int(1))*.

8. *Change Permissions Manager* (`scripts/permissions/change-manager.js`): Token manager can change the permissions manager via an application call to the controller smart contract. If the parameters are correct, tx is accepted and controller smart contract updates the `permission_manager` in it's global state.

### Other Solution

The solution in this template extends [Algorand Dev Office Hour](https://register.gotowebinar.com/recording/recordingView?webinarKey=1651582324861824270&registrantEmail=ratikjindal21%40gmail.com) idea presented by Jason - using asset clawback as escrow for permissioned token.
In this template we have a new contract - `controller.py` which essentially "controls" the asset/token. This controls the general properties of the asset and also ensures that rule(s) smart contract(s) are called.

### Links

Developer hour links:
- Developer Office Hours | Assets and Custom Transfer Logic Using Algorand Smart Contracts: [video](https://www.youtube.com/watch?v=aMDZamxtR14)
- [Assets and Custom Transfer Logic](https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/)
- *implementation of the solution above using algob*: [examples/restricted-assets](/examples/restricted-assets)

Link to spec of current template: [https://paper.dropbox.com/doc/Algob-Security-Token-Template-FR2LXhVg3edevYPBQZw6F](https://paper.dropbox.com/doc/Algob-Security-Token-Template-FR2LXhVg3edevYPBQZw6F)

### Use Case API

Below we describe different use cases implemented by the smart contract suite. We use a function notation for a use-case, along with description of transaction group which has to be created. We implemented that use cases using functions in `scripts` directory. For direct integration in smart contracts, you need to construct transactions as described below.

#### Query

1. [*totalSupply(assetIndex)*](examples/permissioned-token/scripts/common/common.js): returns total supply of the asset (*asset.total* - *asaReserveHolding.amount*). To retreive the asset holding of an account, use algob  [*balanceOf*](https://scale-it.github.io/algo-builder/api/algob/modules.html#balanceof) function in `algob`.

#### Admin
1. [*issue(address, amount)*](examples/permissioned-token/scripts/admin/issue.js): Group of 2 transactions
   - *tx1*: Call to controller smart contract with a) application arg `str:issue` b) foreign Asset: `assetIndex` - signed by asset reserve (issuer).
   - *tx2*: Asset clawback transaction from asset reserve to address = `address`, amount = `amount`.

2. [*kill()*](examples/permissioned-token/scripts/admin/kill.js): Application call to controller with a) appArg `str:kill` and b) foreignAsset `assetIndex`- signed by asset manager.

3. [*forceTransfer (fromAddress, toAddress, amount)*](examples/permissioned-token/scripts/admin/force-transfer.js): Group of 4 transactions
   - *tx1*: Call to controller smart contract with a) application arg `str:force_transfer` b) foreign Asset: `assetIndex` - signed by asset manager.
   - *tx2*: Asset clawback transaction from `fromAddress` to `toAddress`, amount = `amount`.
   - *tx3*: Payment transaction to clawback (contract account) with amount >= fee of *tx2*
   - *tx4*: Call to permissions smart contract with a) application arg `str:transfer` b) app accounts: [`fromAddress`, `toAddress`].

    **NOTE**: *tx3*, *tx4* can be signed by anyone but they must be present in group (they validate conditions). The signer will pay transaction fees. If receiver of `forceTransfer` is the current asset reserve then a permissions smart contract call is not required.

4. *updateReserveByAssetConfig (newReserveAddress)*: Group of 4 transactions
   - *tx1*: Call to controller smart contract with a) application arg `str:force_transfer` b) foreign Asset: `assetIndex` - signed by asset manager.
   - *tx2*: Asset clawback transaction from `oldReserveAddress` to `newReserveAddress`, amount = `oldReserveHolding.amount` (moving all tokens to new reserve address).
   - *tx3*: Payment transaction to clawback (contract account) with amount >= fee of *tx2*
   - *tx4*: Asset Config transaction updating reserve address to `newReserveAddress` - signed by asset manager.

    **NOTE**: If *tx4* is asset config transaction (updating reserve address to *newReserveAddress*) in `forceTransfer` group, then a permissions smart contract call is not required (as we're moving all tokens in *tx2* from old reserve to new one).

5. [*updateReserveByRekeying (newReserveAddress)*](examples/permissioned-token/scripts/admin/update-reserve.js): Transaction rekeying oldReserve account to `newReserveAddress` - signed by old reserve account.

### User

1. [*transfer (fromAccount, toAddress, amount)*](examples/permissioned-token/scripts/user/transfer.js): Group of 4 transactions
   - *tx1*: Call to controller smart contract with application arg `str:transfer` - signed by *fromAccount*.
   - *tx2*: Asset clawback transaction from `fromAccount.address` to `toAddress`, amount = `amount`.
   - *tx3*: Payment transaction to clawback (contract account) with amount >= fee of *tx2*
   - *tx4*: Call to permissions smart contract with a) application arg `str:transfer` b) app accounts: [`fromAccount.address`, `toAddress`].

2.  [*optOut (account)*](examples/permissioned-token/scripts/user/opt-out.js): Asset transfer transaction from `account.address` to `account.address`, amount = 0, **closeRemainderTo** = asset.creator.
    **NOTE**: User opts out from the permissioned token. Algorand will transfer all his tokens to the ASA creator not the ASA reserve account (by definition of Algorand opt-out transaction).

### Permissions

1. [*whitelist (permissionsManager, address)*](examples/permissioned-token/scripts/permissions/whitelist.js): NoOp call to the permissions smart contract with a) application arg `str:add_whitelist` b) app accounts: [`address`] - must signed by *permissionsManager*.

2. [*changePermissionsManager (permissionsManager, newManagerAddress)*](examples/permissioned-token/scripts/permissions/change-perm-manager.js): NoOp call to the permissions smart contract with a) application arg `str:change_permissions_manager` b) app accounts: [`newManagerAddress`] - signed by *permissionsManager* (current permissions manager).
