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
2. *1-setup-apps.js*: In this script we first deploy `controller.py` smart contract (which saves the token_id & sets kill_status to false by default). Only token manager can deploy this contract. Secondly, we deploy the `permissions.py` smart contract, which has the rules. During permisssions deployment, we save the controller_app_id in it's global state.
3. *2-asset-clawback.js*: Here we deploy the contract `clawback.py` and add some funds to it. In contract we save token_id, controller_app_id. After that we update the asset clawback to the address of the contract account (using algob ModifyAsset transaction)

### Execution

1. *Issuance* (`/scripts/issuance/issue.js`): Issuer can issue/mint tokens. Receiver will need to opt-in to the token before the issuance. For issuance tx, we need a transaction group of:
a) Call to the controller smart contract - it checks if token is not killed (as issuance is not allowed if token is killed).
b) Asset transfer transaction from issuer -> receiver using clawback. `clawback.py` does the basic sanity checks for issuance_tx.
We don't need additional rule checks as issuer sets the rules himself.

2. *Update Asset Reserve* (`/scripts/issuance/update-reserve.js`): If the _reserve account_ is a multisig address and we want to kick out one address from the multisig, then we will need to update the asset reserve address. One approach is we update the asset reserve using *ModifyAsset* transaction, and move all tokens from previous reserve -> new reserve. This can be done in an atomic transaction group of 2 txns:
a) Asset transfer transaction using clawback escrow where we move all tokens from previous reserve to new one.
b) Asset Modification transaction where we update the asset reserve address to new one.
Another approach is to *rekey* ASA's Reserve account to the newReserve. This way you won't need to move all tokens from old reserve to new reserve. Now for transactions related to the asset reserve (eg. issuance), `fromAccountAddr` will be the old reserve address, but signing authority will be new reserve account.

3. *OptOut* (`/scripts/issuance/opt-out.js`): User can optOut from the token if he wants to. This could be a simple asset transfer transaction from user -> creator (using user's sk) where asset_amount = 0 & close_remainder_to is asset creator. This tx will opt out a user from the token and transfer all his tokens to the asset creator.
NOTE: If asset creator and reserve are different address, then we will need to transfer all tokens from creator to reserve as well (to take those tokens out of circulation/increase total supply).

4. *Asset transfer* (`scripts/transfer/transfer.js`): A non-reserve account can hold few tokens (via issuance) and may wish to transfer some tokens to another non-reserve account. This should be in complaince with rules checks (`permissions.py`). For token transfer we need a group of at least 4 transactions (and more if there are more than 1 rules contracts):
a) call to controller smart contract (this ensures all rules are checked)
b) token transfer transaction from sender -> receiver using clawback (clawback contract ensures controller smart contract is called).
c) payment transaction from sender -> clawback (to cover tx fee of above transaction)
d) call to permissions smart contract (to check rules: max token holding by receiver < 100, both from & to are whitelisted)

5. *Forced Asset transfer* (`scripts/transfer/force-transfer.js`): This is similar to asset transfer, but in this case the assets are being moved by asset manager, rather than the from account itself (fails otherwise). The transaction group is also similar to above, difference being that call to controller, permissions ssc & paying fees of escrow is done by asset manager. Asset manager essentially represents clawback here (revoking tokens from an account).

6. *Kill Token* (`scripts/permissions/kill.js`): Token manager can kill the token. If the token is killed then all issuance and token transfer transactions are rejected. User can only opt-out from the token to remove his holding and decrease his account's minimum balance.

    a) To kill the token, execute an application call tx to the controller smart contract with appArg: 'kill'. Only ASA mangager can do that. Controller updates the global state key (*is_token_killed*) to true.

7. *Whitelist User* (`scripts/permissions/whitelist.js`): Only a permissions manager (whose address is stored in the controller smart contract) can add a new user to the whitelist which enables that user to receive or send tokens.
For executing this tx, permissions manager calls the permissions smart contract with application arg "add_whitelist", and passes the account he wishes to whitelist in AppAccount array. `token_id` is also passed in the ForeignAsset array to verify token. If tx is successful, then permission smart contract updates the local state of `Txn.accounts[1]` & set *whitelisted = true (Int(1))*.

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
