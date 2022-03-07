# Unique NFT ASA

In this example we present a use-case to create an nft using Algorand's ASA with total_supply == 1, decimals == 0. Uniqueness of an NFT is ensured by a smart-contract. More specifically, we use a use cased and solution described in the [prime number NFT](https://forum.algorand.org/t/unique-nft-asa-implementation/2704/2) forum post. Smart contract controls that there is only one NFT registered with a given prime number and assures that the information about the prime number doesn't leak until the NFT is created.

Contracts:

- _nft-app-approval.py:_ NFT App. Controls creation & transfer of NFT by `C_p`.
- _stateless.py:_ Stateless contract(lsig) which creates and transfers the NFT, represented as `C_p`. It:
  a) has `p` hardcoded as a constant
  b) requires any transaction from C_p to be in a group of transactions with a call to App

_NOTE:_ 2 same lsigs with `p` (code) will always have the same address. So, nft deployed by _C_p_ will always be unique.

## Functions

We use functional notation to describe use cases we implemented.

- `createNFT(creator, p)` — creates a NFT for a prime numer `p`. It composes a group of three transactions:

  - _tx0_: Payment of 1 ALGO to C_p (can be from any account).
  - _tx1_: OptIn to NFT App with _appArgs:_ [p].
  - _tx2_: Deploy NFT by `C_p`.

- `transferNFT(creator, p)` — transfers NFT from `C_p` back to the `creator`. Transaction composition:
  - _tx0_: Call to NFT App. App check that `p` and `creator` are set, and erase creator. It also checks the second transaction is an NFT transfer from `C_p` to `creator`.
  - _tx1_: `C_p` sends the NFT to `creator`.

**NOTE:** We don't implement "hiding" strategy. The implemented solution doesn't protect against MEW. Read more about it [the forum post](https://forum.algorand.org/t/unique-nft-asa-implementation/2704/2) (registration part).
