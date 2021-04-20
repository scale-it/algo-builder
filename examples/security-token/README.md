# Security Token

Security tokens are permissioned tokens that carry complex compliance requirements, such as investor whitelisting and transfer restrictions. For example, token holders outside the U.S. can be prevented from transferring a token to a U.S. individual.

## Motivation
Specifically, in Security Tokens, we want to:
- Control the number of tokens minted for distribution and also allow flexibility for the administrator to issue more tokens in the future.
- Create whitelists of individuals who are approved to buy/hold the tokens and segregated sublists, as needed, to support transfer restrictions (e.g., U.S. vs international).
- Manage lock-ups as needed to ensure there are not transfers before allowed.
- Process requirements or needs that come up post-issuance, such as adding or removing investors to the whitelists or creating additional whitelists for new restrictions.
- Take confidence in the ability to remove restrictions in the future if transfers become open or unlimited.
The Security Token Template outlines a design of security tokens with emphasis for shares and equity.

## Design Overview

We want to enforce permissioned checks on all token transfer between non-reserve accounts. We will use a stateless TEAL as a clawback, which will execute all transfers. So if user A wants to transfer to user B, it will be a clawback which will transfer from account A to account B.
Steps:

1. Create assets
2. Distribute to initial users
3. Freeze all assets OR create the asset default-frozen (clawback can still move frozen tokens).
4. Create a stateful contract with rules/permissions (`P`) and another contract: controller (`C`). P will store the C address (which can be modified).
5. Create a stateless teal (escrow contract `clawback-escrow`) which will check that the C and P is called as well.
6. Update the clawback address to the contract `clawback-escrow`.
7. Whenever user A want's to transfer some tokens to B, he will need to combine this transaction with a clawback asset transfer transaction.
8. Clawback transfer ensures a call to the controller smart contract (`C`). Controller has the application id of permissions/rules smart contract (`P`), and hence ensures `P` is called as well.

### Specification

Smart contracts (in `/assets`):
- *clawback-escrow.py*: The asset clawback is a contract account represent by this smart contract. It's logic ensures that during token transfer between non-reserve accounts, `controller` smart contract is called. It also handles issuance transaction & update reserve account transaction.
- *controller.py*: This smart contract acts as a controller of the token. It ensures that during token transfer permissions/rules smart contract is called. If there are multiple rules contract, then controller must ensure that all those contracts are called as it stores the app_id & manager of the permissions smart contract. Controller smart contract can also be used to kill the token.
- *permissions.py*: This is the rules smart contract. In this template we have two rules:
  - An account cannot hold more than 100 tokens
  - Both from, to accounts must be whitelisted
- *clear_state_program.py*: clear state program (returns 1)

`assets/asa.yaml` - This the the asset definition file.

### Setup

Deployment scripts are placed directly in `/scripts`:

**NOTE:** For transactions involving a multisig account (eg. token can be created and issued by a multisig), user will control one of the multisig accounts and he will receive a signed transaction i.e a signed `deployASA` tx by accounts in msig <= threshold. User can append his/her using `algob sign-multisg` command & then use `executeSignedTxFromFile` function to successfully send transaction to network (eg. deploy token).

1. *0-setup-token.js*: In this script we deploy the token (as an Algorand Standard Asset) using `deployer.deployASA(..)` function. Check note above if creator is a multisig address.
NOTE: In the template
2. *1-setup-apps.js*: In this script we first deploy `controller.py` smart contract (which saves the token_id & sets kill_status to false by default). Only token manager can deploy this contract. Secondly, we deploy the `permissions.py` smart contract, which has the rules. During permisssions deployment, we save the controller_app_id in it's global state.
3. *2-asset-clawback.js*: Here we deploy the contract `clawback-escrow.py` and add some funds to it. In contract we save token_id, controller_app_id. After that we update the asset clawback to the address of the contract account (using algob ModifyAsset transaction)

### Execution

1. *Issuance* (`/scripts/issuance/issue.js`): Issuer can issue/mint few tokens to an account. Receiver will need to opt-in to the token first. For issuance tx, we need a transaction group of two transactions :-
a) Call to the controller smart contract - it checks if token is not killed (as issuance is not allowed if token is killed).
b) Asset transfer transaction from issuer -> receiver using clawback. `clawback-escrow.py` does the basic sanity checks for issuance_tx.
We don't need additional rule checks as issuer sets the rules himself.

2. *Update Asset Reserve* (`/scripts/issuance/update-reserve.js`): Say if reserve is a multisig address and we want to kick out one address from the multisig, then we will need to update the asset reserve address. Also, if we update the asset reserve, we will need to move all tokens from previous reserve -> new reserve. This can be done in an atomic transaction group of 2 txns:
a) Asset transfer transaction using clawback escrow where we move all tokens from previous reserve to new one.
b) Asset Modification transfer where we update the asset reserve address to new one.

3. *OptOut* (`/scripts/issuance/opt-out.js`): User can optOut from the token if he wants to. This could be a simple asset transfer transaction from user -> creator (using user's sk) where assetamount = 0 & closeRemainderTo is asset creator. This tx will opt him out of the token and transfer all his tokens to the asset creator.
NOTE: If asset creator and reserve are different address, then we will need to transfer all tokens from creator to reserve as well (to take those tokens out of circulation/increase total supply).

4. *Asset transfer* (`scripts/transfer/transfer.js`): A non-reserve account can hold few tokens (via issuance) and may wish to transfer some tokens to another non-reserve account. This should be in complaince with rules checks (`permissions.py`). For token transfer we need a group of "atleast" 4 transactions (and more if there are more than 1 rules contracts):
a) call to controller smart contract (this ensures all rules are checked)
b) token transfer transaction from sender -> receiver using clawback (clawback contract ensures controller smart contract is called).
c) payment transaction from sender -> clawback-escrow (to cover tx fee of above transaction)
d) call to permissions smart contract (to check rules: max token holding by receiver < 100, both from & to are whitelisted)

5. *Kill Token* (`scripts/permissions/kill.js`): Token manager can kill the token. If the token is killed then all issuance and token transfer transactions are rejected. User can only opt-out from the token to remove his holding and decrease his account's minimum balance.
a) To kill the token, execute an application call tx to the controller smart contract with appArg: 'kill'. Only ASA mangager can do that. Controller updates the global state key (*is_token_killed*) to true.

6. *Whitelist User* (`scripts/permissions/whitelist.js`): Permissions manager can add a new user to the whitelist which enables that user to receive or send tokens. Only permissions manager (which is stored in the global state of controller smart contract) can add a user to whitelist.
For executing this tx, permissions manager calls the permissions smart contract with application arg "add_whitelist", and passes the account he wishes to white list in AppAccount array. `token_id` is also passed in the ForeignAsset array to verify token. If tx is successful, then permission smart contract updates the local state of `Txn.accounts[1]` & set *whitelisted = true (Int(1))*.

7. *Change Permissions Manager* (`scripts/permissions/change-manager.js`): Token manager can change the permissions manager via an application call to the controller smart contract. If the parameters are correct, tx is accepted and controller smart contract updates the `permission_manager` in it's global state.

### Other Solution

The solution in this template extends Jason's original idea - using asset clawback as escrow for security token.
In this template we add a new contract - `controller.py` which essentially "controls" the asset/token. This controls the general properties of the asset and also ensures that rule(s) smart contract(s) are called.

### Links

Developer hour links:
- *video:* [https://www.youtube.com/watch?v=aMDZamxtR14](https://www.youtube.com/watch?v=aMDZamxtR14)
- *article:* [https://developer.algorand.org/solutions/assets-and-custom-transfer-logic](https://developer.algorand.org/solutions/assets-and-custom-transfer-logic/)
- *implementation of above solution using algob*: [examples/restricted-assets](/examples/restricted-assets)

Link to spec of current template: [https://paper.dropbox.com/doc/Algob-Security-Token-Template-FR2LXhVg3edevYPBQZw6F](https://paper.dropbox.com/doc/Algob-Security-Token-Template-FR2LXhVg3edevYPBQZw6F)