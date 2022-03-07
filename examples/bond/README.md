# Algorand bond token

Bonds are units of corporate debt issued by companies and securitized as tradeable assets. A bond is referred to as a fixed-income instrument since bonds traditionally paid a fixed interest rate (coupon) to debt holders. Variable or floating interest rates are also now quite common. Bond prices are inversely correlated with interest rates: when rates go up, bond prices fall and vice-versa.

In this template, we use ALGO to express the nominal and trading values (investors will buy, sell and exchange bonds using ALGO). It's easy to change this and use any other ASA.

When creating a bond the following information must be recorded:

- `issue_price` — price of a bonds sold by the issuer.
- `nominal_price` — bond nominal price, it’s fixed.
- `maturity_date` — date when a bond holder can redeem bonds to the issuer, it’s fixed.
- `coupon_value` — interest paid annually to the bond holders,
  equals to `coupon_rate x nominal_price`.

### Use Cases

We use functional notation to describe use cases we will implement.

- `issue(amount)` — issue new bonds to the issuer account.
- `burn(amount)` — issuer can burn unsold bonds.
- `buy(amount)` — investor will buy bond from the issuer account by paying
  `amount×issue_price` (in ALGO).
- `exchange(price, amount)` — group of transactions including a buyer transaction paying amount×price of ALGO to the seller (signed by buyer), and seller transaction sending amount of bonds to the buyer (signed by seller).
- `transfer(amount, recipient)` — bond holder can transfer amount of bonds to someone else.
- `exit(amount)` — after maturity bond holder can send bonds back to the issuer and receive `amount×nominal_price` back. Issuer must provide enough funds to the issuer account upon the maturity date. Otherwise a legal consequences can be triggered.
- `redeem_coupon()` — bond holder can get his interest (in ALGO).

Note: In this example we have constant `coupon_value` for all the epochs, we can make variable by having this value hardcoded in each `DEX_i`.

## Spec document

App template [specification](https://paper.dropbox.com/doc/Algorand-Bond-Template--BOU8bTQSnmRNk23KK8McWwxXAg-hzI7C681Soo2sr6iyGFzg).

## Deploy script

We have deploy script in `scripts/deploy`, This script deploys initial bond token, deploys bond dapp application and updates issuer address in bond-dapp contract.

## Run script

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
