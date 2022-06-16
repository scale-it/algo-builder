# Algo Builder DAO

A decentralized autonomous organization (DAO) is an entity with no central leadership. Decisions get made from the bottom-up, governed by a community organized around a specific set of rules enforced on a blockchain. DAOs are internet-native organizations collectively owned and managed by their members. They have built-in treasuries that are only accessible with the approval of their members. Decisions are made via proposals the group votes on during a specified period.

A DAO is usually implemented using blockchain smart contracts:

- organization is managed by a defined group
- blockchain and smart contracts is a trustless execution layer where rules and decisions are recorded
- decisions are usually made by voting.

In this template, We are going to implement a DAO, where the members are defined by ASA holding (1 ASA = 1 voting power): each token holder is a DAO member and can participate equally in the governance.

Every DAO has the following parameters:

- `deposit` — a deposit amount in `gov_tokens` required to make a proposal.

- `min_support` — a minimum number of `yes` power votes (other votes like `abstain` and `no` are not counted) to validate the proposal.

- `min_duration` — minimum voting time (in number of seconds) for a new proposal.

- `max_duration` — maximum voting time (in number of seconds) for a new proposal.

- `url` — a link with more information about the DAO. We don’t need a hash as this document is meant to evolve and provide more details together with the DAO evolution.

### Use Cases

We use functional notation to describe use cases we will implement.

- `initialize(deposit_amount, min_support, min_duration, ..)` — Creates a DAO app and records all above parameters in it’s global state except the gov. Transaction composition:

  - _tx0_: `deployer.deployApp` transaction with _appArgs:_ [deposit, min_support, min_duration, max_duration, url].

- `add_proposal(url: string, ..)` — Records proposal in lsig (local state). One lsig can have maximum one active proposal. If a proposal is not active any more we can reuse the lsig to record a new proposal. Transaction composition:

  - _tx0_: Call to DAO App with _daoParams_.
  - _tx1_: Deposit _gov_tokens_ to _depositLsig_.

- `deposit_vote_token(amount)` — User can only vote with the deposited tokens (to avoid double voting by sending tokens to someone else). User can vote with the “same” tokens for multiple proposals. Transaction composition:

  - _tx0_: Call to DAO App with _appArg_ == "deposit_vote_token".
  - _tx1_: Deposit _gov_tokens_ to _depositLsig_ (each token == 1 vote).

- `withdraw_vote_deposit(amount)` — This is used to unlock the deposit and withdraw tokens back to the user. To protect against double vote, user can only withdraw the deposit after the latest voting he participated in ended. Transaction composition:

  - _tx0_: Call to DAO App with _appArg_ == "withdraw_vote_deposit".
  - _tx1_: Withdraw _gov_tokens_ from _depositLsig_ (ASA transfer).

- `vote(proposalLsig, voteType)` — Records vote by voterAcc in proposal (vote can be one of `yes`, `no`, `abstain`). Transaction composition:

  - _tx0_: Call to DAO App with _appArg_ == ["register_vote", *vote_type*]. `proposalLsig.address()` is passed as first external account.

  **Note1**: User can vote only once for a given proposal and he will vote with all tokens he deposited before casting the vote.
  **Note2**: User can only vote on 14 active proposals at a time.

- `execute()` — Executes a proposal. NOTE: anyone is able to execute a proposal (this way we protect from a situation that a proposer will not be satisfied from the result and will not execute it). Transaction composition:

  - _tx0_: Call to DAO App with _appArg_ == "execute".
  - _tx1_: As per proposal instructions (ALGO transfer/ASA transfer/none)

- `clear_vote_record(proposal_lsig)` — Clears Sender local state by removing a record of vote cast from a not active proposal. Transaction composition:

  - _tx0_: Call to DAO App with _appArg_ == ["clear_vote_record"]. `proposalLsig.address()` is passed as first external account.

- `close_proposal()` — Closes proposal record and returns back the deposit. Sender must be an account with a recorded proposal. Transaction composition:
  - _tx0_: Call to DAO App with _appArg_ == "close_proposal".
  - _tx1_: Withdraw _gov_tokens_ from _depositLsig_ back to _proposalLsig_ (ASA transfer).

- `withdraw_from_proposal()` - Withdraw the assets from the proposalLsig back to the owner. Receiver must be the owner of the proposalLsig. Transaction composition:
 - _tx0_: Withdraw _gov_tokens_ from _proposalLsig_ back to _proposer_ (owner) (ASA transfer).

## Setup Sigma Dao

Setup the sigma_daos table. Indexer should be running before executing below script.

Create a sigma dao user, if not already created:

    make create-sigma-dao-user

Setup sigma dao:

    make setup_sigma_dao

Run below script to delete the sigma dao user, sigma dao user should be present:

    make drop-sigma-dao-user

## Spec document

Algo Builder DAO [specification](https://paper.dropbox.com/doc/Algo-Builder-DAO--BRlh~FwufNzIzk4wNUuAjLTuAg-ncLdytuFa7EJrRerIASSl).

## Deploy script

We created a deploy script in `scripts/deploy`, This script deploys initial Gov token, deploys DAO app, fund lsig's, saves deposit_lsig address to DAO app, and does initial distribution of ASA (Gov token).

## Scripts

Please read the spec document (linked above) for more details about each use case. The scripts provide only a sample code to show how to use the template. For you private needs, you will have to modify the scripts directory to adjust the parameters (eg voting time, execution time etc...) and the proposals.

To add proposal (`{voting_start, voting_end}` is set as `{now + 1min, now + 3min}`):

    yarn run algob run scripts/run/add_proposal.js

To deposit votes:

    yarn run algob run scripts/run/deposit_vote_token.js

To vote for a proposal (using deposited tokens):

    yarn run algob run scripts/run/vote.js

To execute a proposal (`execute_before` is set as 7min from the time of proposal creation):

    yarn run algob run scripts/run/vote.js

To withdraw deposited votes (withdrawn from depositLsig to voter account):

    yarn run algob run scripts/run/withdraw_vote_deposit.js

To clear vote record (from voter's account), fails if the proposal is still in progress:

    yarn run algob run scripts/run/clear_vote_record.js

To close proposal record (from proposal_lsig as a sender), fails if the proposal is still in progress:

    yarn run algob run scripts/run/close_proposal.js

To withdraw assets from proposalLsig back to the owner (proposer), fails if the receiver is not the owner of the proposalLsig:

    yarn run algob run scripts/run/withdraw_from_proposal.js
