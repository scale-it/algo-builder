# Algorand bond token

Bonds are units of corporate debt issued by companies and securitized as tradeable assets. A bond is referred to as a fixed-income instrument since bonds traditionally paid a fixed interest rate (coupon) to debt holders. Variable or floating interest rates are also now quite common. Bond prices are inversely correlated with interest rates: when rates go up, bond prices fall and vice-versa. 

In this template, we use ALGO to express the nominal and trading values (investors will buy, sell and exchange bonds using ALGO). It's easy to change this and use any other ASA.

When creating a bond the following information must be recorded:

- `issue_price` — price at which bonds are sold by the issuer.
- `nominal_price` — bond nominal price, it’s fixed.
- `maturity_date` — date when a bond holder can redeem bonds to the issuer, it’s fixed.
- `coupon_value` — interest paid annually to the bond holders, 
        equals to `coupon_rate x nominal_price`.

### Use Cases

We use functional notation to describe use cases we will implement.

- `issue(amount)` — issue new bonds to the issuer account.
- `burn(amount)` — issuer can burn not sold bonds.
- `buy(amount)`  — investor will buy bond from the issuer account by paying 
        `amount×issue_price` (in ALGO).
- `exchange(price, amount)` — group of transactions including a buyer transaction paying amount×price of ALGO to the seller (signed by buyer), and seller transaction sending amount of bonds to the buyer (signed by seller). 
- `transfer(amount, recipient)` — bond holder can transfer amount of bonds to someone else.
- `exit(amount)`  — after maturity bond holder can send bonds back to the issuer and receive `amount×nominal_price`  back. Issuer must provide enough funds to the issuer account upon the maturity date. Otherwise a legal consequences can be triggered.
- `redeem_coupon()`  — bond holder can get his interest (in ALGO).

Note: In this example we have constant `coupon_value` for all the epochs, we can make variable by having this value hardcoded in each `DEX_i`.

## Spec document

App template [specification](https://paper.dropbox.com/doc/Algorand-Bond-Template--BOU8bTQSnmRNk23KK8McWwxXAg-hzI7C681Soo2sr6iyGFzg).
