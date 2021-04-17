---
layout: splash
---

# Deployer

Deployer wraps an SDK `AlgodV2` client and provides a higher level functionality to deploy [Algorand Standard Assets(ASA)](https://developer.algorand.org/docs/features/asa/) and [Stateful Smart Contracts(SSC)](https://developer.algorand.org/docs/features/asc1/stateful/) to the Algorand network:
* load ASA definition files
* load smart-contract files
* create transaction log and checkpoints.

It will protect you from deploying same ASA or stateful smart contract twice. It will store transaction log in a checkpoint and allow you to reference later (in other scripts or in REPL) deployed ASA.

Read more about deployment and scripts in our [spec](https://paper.dropbox.com/doc/Algorand-builder-specs--A_yfjbGmtkx5BYMOy8Ha50~uAg-Vcdp0XNngizChyUWvFXfs#:uid=213683005476107006060621&h2=Scripts).

## Example

When you initiate a new project, it will create a `sample-project` with the deployment script `scripts/0-sampleScript.js`,

You can write deployment tasks synchronously and they'll be executed in the correct order.

### ASA

    // ASA-1 will be deployed before ASA-2
    await deployer.deployASA("ASA-1", {...});
    await deployer.deployASA("ASA-2", {...});

To deploy an ASA you must have `asa.yaml` file in `assets` folder. Head to the [ASA Definition File Spec](https://paper.dropbox.com/doc/Algorand-builder-specs-Vcdp0XNngizChyUWvFXfs#:uid=077585002872354521007982&h2=ASA-Definition-File) to learn more.

For opting in to ASA, `deployer` supports two methods :-
- `optInAcountToASA` to opt-in to a single account signed by secret key of sender.
- `optInLsigToASA` to opt-in to a contract account (say escrow) where the account is represented by the logic signature address (`lsig.address()`).

### Smart contracts

You can deploy Stateful/Stateless Smart Contracts (SSC).

#### Stateful Smart Contracts
Check our [examples/permissioned-voting](../examples/permissioned-voting) project. Open the `scripts/voting.js` file, you will find there:

    await deployer.deploySSC("approval.teal", "clear.teal", {...});

Smart contracts must be stored in `assets` folder.

The main difference between deploying an ASA and SSC is that ASA takes `asset-name` and `ASADeploymentFlags` as input and SSC takes `smart-contract-names` and `SSCDeploymentFlags` as input.

You can learn more about the flags from [Deployer API](https://scale-it.github.io/algo-builder/);
You can learn more about Stateful Smart Contracts [here](https://developer.algorand.org/docs/features/asc1/stateful/).

#### Stateless Smart Contracts

- *Contract Mode:*

  Contract accounts act in a similar fashion to escrow accounts, where when the smart contract is compiled it produces an Algorand address. This address can accept Algos or Algorand ASAs with standard transactions, where the contract’s address is the receiver of the transaction.

  Contract accounts can be also be used to deploy ASAs.

   Check our [examples/htlc-pyteal-ts](../examples/htlc-pyteal-ts) project to explore how to deploy Stateless Smart Contracts(lsig). In the file `scripts/deploy.ts`, you will find:

  ```
  await deployer.fundLsig('htlc.py',
    { funder: bob, fundingMicroAlgo: 2e6 }, {}, [], scTmplParams);
  ```
  `fundLsig` funds the contract account (compiled hash of the smart contract). The function `fundLsig` accepts `pyteal` code too, which provides the functionality of dynamically providing the params before compiling into TEAL code.

- *Delegated Signature Mode*:

  Stateless smart contracts can also be used to delegate signature authority. When used in this mode, the logic of the smart contract is signed by a specific account or multi-signature account. This signed logic can then be shared with another party that can use it to withdrawal Algos or Algorand ASAs from the signing account, based on the logic of the contract.

  Use `mkDelegatedLsig` function to compile and sign a logic signature & save it to checkpoint.
  ```javascript
  const ascInfoGoldDelegated = await deployer.mkDelegatedLsig('4-gold-asa.teal', goldOwner, []);
  console.log(ascInfoGoldDelegated);
  ```

You can learn more about Stateless Smart Contracts [here](https://developer.algorand.org/docs/features/asc1/stateless/).