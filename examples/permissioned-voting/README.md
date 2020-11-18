# Example Permissioned Voting Stateful Smart Contract Application

This project shows how to create Permissioned Voting Stateful Smart Contract Application.
To create this type of application on Algorand, there are four steps that must be supported:

- Create Asset - Central authority needs to create a voting token using Algorand ASAs. Voters need to opt into this asset, and the asset ID needs to be stored in the stateful smart contract to verify when the user votes, and confirm they are spending their voting token.
To create `vote-token`, we recommend to create assets using a specification file, as provided in `assets/asa.yaml`.

- Create Voting Smart Contract - Central authority needs to create the voting smart contract on the Algorand blockchain and pass the round ranges for registering and voting. The creator address is passed into the creation method. This is used only to allow the creator to delete the voting smart contract. we use `pyTeal` to create contracts, as provided in `assets/` as `permissioned-voting-approval.py` and `permissioned-voting-clear.py`.
we creating the application using `scripts/voting.js`

- Register to Vote - Voters need to register with the voting smart contract by optioning into the contract. Registering to vote occurs between a set of rounds that is set during the creation of the contract. We Opt-In for a voter using `scripts/voting.js`.

- Vote - Voters vote by atomically grouping two transactions and submitting them to the blockchain. The first transaction is a call to the smart contract casting a vote for either candidate A or candidate B. The second transaction is an asset transfer from the voter to the central authority to spend their voting token.
To cast a vote, we are using `scripts/vote/vote.js`

The result of the elections can be decided using `scripts/vote/result.js`.

The application is deleted and voter account is cleared using `scripts/vote/result.js`.

## Setup

Please follow the [setup](../README.md) instructions to install dependencies and update the config.

### Run

To Create Vote-Token Asset and Permissioned voting application:

        yarn run algob deploy

To Cast a Vote:

        yarn run algob run scripts/vote/vote.js

To see the results and delete the application:

        yarn run algob run scripts/vote/result.js

Original Tutorial can be found [here](https://developer.algorand.org/solutions/example-permissioned-voting-stateful-smart-contract-application/)
