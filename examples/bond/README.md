# Algorand bond token

Bonds are units of corporate debt issued by companies and securitized as tradeable assets. A bond is referred to as a fixed-income instrument since bonds traditionally paid a fixed interest rate (coupon) to debt holders. Variable or floating interest rates are also now quite common. Bond prices are inversely correlated with interest rates: when rates go up, bond prices fall and vice-versa. 

For simplicity, the nominal and trading values are expressed in ALGO (investors will buy, sell and exchange bonds using ALGO).

When creating a bond the following information must be recorded:

- `issue_price` — price at which bonds are sold by the issuer.
- `nominal_price` — bond nominal price.
- `maturity_date` — date when a bond holder can redeem bonds to the issuer.
- `coupon_value` — interest payed annually to the bond holders, 
        equals to `coupon_rate x nominal_price`.

Use Cases. We use functional notation to describe use cases we will implement.

- `issue(amount)` — issue new bonds to the issuer account.
- `burn(amount)` — issuer can burn not sold bonds.
- `buy(amount)`  — investor will buy bond from the issuer account by paying 
        `amount×issue_price` (in ALGO).
- `exchange(price, amount)` — group of transactions including a buyer transaction paying amount×price of ALGO to the seller (signed by buyer), and seller transaction sending amount of bonds to the buyer (signed by seller). 
- `transfer(amount, recipient)` — bond holder can transfer amount of bonds to someone else.
- `exit(amount)`  — after maturity bond holder can send bonds back to the issuer and receive `amount×nominal_price`  back. Issuer must provide enough funds to the issuer account upon the maturity date. Otherwise a legal consequences can be triggered.
- `redeem_coupon()`  — bond holder can get his interest (in ALGO).

## Design Overview

Requirements

- We will use ASA to represent a bond. The advantage of  this is that we will use all standard tooling to track ASA and represent bond as an asset in a standard algorand way.

The solution consist of:

- `BondAddp` - a stateful smart contract which will store the bond parameters: issue price, nominal price, maturity date and coupon date. Additionally, the App will store a reference to the currently tradeable bond ASA and the current epoch number.
- `epoch` — stored in the `BondApp` is the current period for paying the coupon. For example: When bond coupons are paid every 6 month, then initially the epoch is 0. After 6 months bond holders receive a coupon for interest payment and start epoch 1. After another 6 months bond holders receive a new coupon for interest payment and we start epoch 2…
- We bundle coupons with bonds in a single token - Bond token (ASA). 
    - There is a different ASA for each epoch: in a single `BondApp` we define family of Bond tokens: `B_0`, `B_1`, `B_2` , … `B_n` .  `B_i` token represent a bond which received a coupon payment at `i-1` epoch but execute a coupon payment at `i` epoch.
    - Holder of `B_i` token can redeem his token and get coupon payment using DEX lsigs (see below)
- Set of logical signatures (stateless contracts): `DEX_0`, `DEX_1` ….
    - `B_i` holder can exchange tokens with `DEX_i` for equal number of `B_{i+1}` tokens and `coupon_value` of ALGOs only when `i < BondApp.epoch`. For example: At epoch 2, user X owns 10 `B_1`  tokens. He can send his tokens to `DEX_1` and in exchange of 10 `B_2` tokens and `10 × BondApp.coupon_value` of ALGOs. NOTE: at epoch 2, user can exchange his `B_0` tokens with `DEX_0` if he didn’t do it yet.
    -  `B_i` tokens sent to `DEX_i` are locked forever. 
    - Issuer must create and supply ALGO to `DEX_i` in advance. Otherwise legal consequences can be triggered.
