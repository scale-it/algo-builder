# Unique NFT ASA

In this example we present a use-case to create an nft using Algorand's ASA with total_supply == 1, decimals == 0.You can ensure uniqueness of NFT by issuing the NFT from a smart contract account where the prime number p is hardcoded. Design based on [this](https://forum.algorand.org/t/unique-nft-asa-implementation/2704/2) thread.

Contracts:
+ *nft-app-approval.py:* NFT App. Controls creation & transfer of NFT by `C_p`.
+ *stateless.py:* Stateless contract(lsig) which creates and transfers the NFT, represented as `C_p`. It:
		a) has `p` hardcoded as a constant
		b) requires any transaction from C_p to be in a group of transactions with a call to App

*NOTE:* 2 same lsigs with `p` (code) will always have the same address. So, nft deployed by *C_p* will always be unique.

## Use Cases

We use functional notation to describe use cases we will implement.

-  `createNFT(creator, p)` — Creation an NFT for the prime `p`. Group of three transactions:
	+ *tx0*: Payment of 1 ALGO to C_p (can be any account).
	+ *tx1*: OptIn to NFT App with *appArgs:* [p].
	+ *tx2*: Deploy NFT by `C_p`.

-  `transferNFT(creator, p)` — Transfer NFT back to `creator` from `C_p`. Transaction composition:
	+ *tx0*: Call to NFT App. App check that `p` and `creator` are set, and erase creator. It also checks the second transaction is an NFT transfer from `C_p` to `creator`.
	+ *tx1*: `C_p` sends the NFT to `creator`.


**NOTE:** We don't implement "hiding" strategy. The smart contract will need hiding for MEW, read more about it [here](https://forum.algorand.org/t/unique-nft-asa-implementation/2704/2) (registration part).