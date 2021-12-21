const { Runtime } = require('@algo-builder/runtime');
const { types, parsing } = require('@algo-builder/web');
const { Vote } = require('../scripts/run/common/common');
const {
  votingStart, votingEnd, executeBefore
} = require('../scripts/run/common/tx-params');

const minBalance = 10e6; // 10 ALGO's
const initialBalance = 200e6;
const deposit = 15; // deposit required to make a proposal
const minSupport = 7; // minimum number of yes power votes to validate proposal

class Context {
  constructor (master, creator, proposer, voterA, voterB, depositLsigAcc, daoFundLsigAcc, proposalLsigAcc) {
    this.master = master;
    this.creator = creator;
    this.proposer = proposer;
    this.voterA = voterA;
    this.voterB = voterB;
    this.depositLsigAcc = depositLsigAcc;
    this.daoFundLsigAcc = daoFundLsigAcc;
    this.proposalLsigAcc = proposalLsigAcc;
    this.runtime = new Runtime([
      master, creator, proposer, voterA, voterB,
      depositLsigAcc, daoFundLsigAcc, proposalLsigAcc
    ]);
    this.deployASA('gov-token', { ...creator.account, name: 'dao-creator' });
    this.deployDAOApp(creator, 'dao-app-approval.py', 'dao-app-clear.py');
    this.setUpLsig();
    this.setDepositLsigInDAO();
    this.distributeGovTokens([
      this.proposer, this.voterA, this.voterB,
      this.depositLsigAcc, this.daoFundLsigAcc
    ], 100);
  }

  // refresh state
  syncAccounts () {
    this.creator = this.getAccount(this.creator.address);
    this.proposer = this.getAccount(this.proposer.address);
    this.voterA = this.getAccount(this.voterA.address);
    this.voterB = this.getAccount(this.voterB.address);
    this.depositLsigAcc = this.getAccount(this.depositLsigAcc.address);
    this.daoFundLsigAcc = this.getAccount(this.daoFundLsigAcc.address);
    this.proposalLsigAcc = this.getAccount(this.proposalLsigAcc.address);
  }

  deployASA (name, creator) {
    this.govTokenID = this.runtime.deployASA(name, { creator: creator }).assetID;
  }

  deployDAOApp (sender, daoApprovalProgramFileName, daoClearStateProgramFileName) {
    // const daoApprovalProgram = getProgram(approvalProgram, , false);
    // const daoClearProgram = getProgram(clearStateProgram, {}, false);

    const daoPlaceholderParam = { ARG_GOV_TOKEN: this.govTokenID };
    const appCreationFlags = {
      sender: sender.account,
      localInts: 9,
      localBytes: 7,
      globalInts: 4,
      globalBytes: 2
    };

    // DAO App initialization parameters
    const minDuration = 1 * 60; // 1min (minimum voting time in number of seconds)
    const maxDuration = 5 * 60; // 5min (maximum voting time in number of seconds)
    const url = 'www.my-url.com';
    const daoAppArgs = [
      `int:${deposit}`,
      `int:${minSupport}`,
      `int:${minDuration}`,
      `int:${maxDuration}`,
      `str:${url}`
    ];

    this.daoAppID = this.runtime.deployApp(
      daoApprovalProgramFileName,
      daoClearStateProgramFileName,
      { ...appCreationFlags, appArgs: daoAppArgs },
      {},
      daoPlaceholderParam
    ).appID;
  }

  setUpLsig () {
    const scInitParam = {
      ARG_GOV_TOKEN: this.govTokenID,
      ARG_DAO_APP_ID: this.daoAppID
    };
    // compile lsig's
    this.depositLsig = this.runtime.loadLogic('deposit-lsig.py', scInitParam, false);
    this.depositLsigAcc = this.runtime.getAccount(this.depositLsig.address());

    this.daoFundLsig = this.runtime.loadLogic('dao-fund-lsig.py', scInitParam, false);
    this.daoFundLsigAcc = this.runtime.getAccount(this.daoFundLsig.address());

    this.proposalLsig = this.runtime.loadLogic('proposal-lsig.py',
      { ARG_OWNER: this.proposer.address, ARG_DAO_APP_ID: this.daoAppID }, false);
    this.proposalLsigAcc = this.runtime.getAccount(this.proposalLsig.address());

    // fund lsig's
    for (const lsig of [this.depositLsig, this.daoFundLsig, this.proposalLsig]) {
      this.runtime.fundLsig(this.master.account, lsig.address(), minBalance + 10000);
    }
    this.syncAccounts();
  }

  setDepositLsigInDAO () {
    // add deposit_lsig address to DAO
    const addAccountsTx = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: this.creator.account,
      appID: this.daoAppID,
      payFlags: {},
      appArgs: [
        'str:add_deposit_accounts',
        `addr:${this.depositLsig.address()}`
      ]
    };
    this.runtime.executeTx(addAccountsTx);
  }

  distributeGovTokens (accounts, amount) {
    // optIn to ASA(Gov Token) by accounts
    for (const acc of [this.proposer, this.voterA, this.voterB, this.depositLsigAcc, this.daoFundLsigAcc]) {
      this.optInToGovToken(acc.address);
    }
    this.syncAccounts();

    // GOV Token distribution (used as initial fund)
    const distributeGovTokenParams = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: this.creator.account,
      amount: amount,
      assetID: this.govTokenID,
      payFlags: { totalFee: 1000 }
    };

    const txParams = [];
    for (const a of accounts) {
      txParams.push({ ...distributeGovTokenParams, toAccountAddr: a.address });
    }

    this.runtime.executeTx(txParams);
    this.syncAccounts();
  }

  // Opt-In account to ASA (Gov Token)
  optInToGovToken (address) {
    this.runtime.optIntoASA(this.govTokenID, address, {});
  }

  // Opt-In to DAO App by address
  optInToDAOApp (address) {
    this.runtime.optInToApp(address, this.daoAppID, {}, {});
  }

  getAccount (address) {
    return this.runtime.getAccount(address);
  }

  executeTx (txnParams) {
    this.runtime.executeTx(txnParams);
  }

  addProposal () {
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'name', parsing.stringToBytes('my-custom-proposal'));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'url', parsing.stringToBytes('myurl.com'));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'url_hash', parsing.stringToBytes('my-hash1234'));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'hash_algo', parsing.stringToBytes('sha256'));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'voting_start', BigInt(votingStart));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'voting_end', BigInt(votingEnd));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'execute_before', BigInt(executeBefore));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'type', 1n);
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'from', parsing.addressToPk(this.daoFundLsig.address()));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'recipient', parsing.addressToPk(this.proposer.address));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'amount', BigInt(2e6));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'id', parsing.stringToBytes('this-txID'));
    this.proposalLsigAcc.setLocalState(this.daoAppID, 'executed', 0n);

    this.syncAccounts();
  }

  depositVoteToken (voterAcc, depositLsig, amount) {
    const senderDeposit = voterAcc.getLocalState(this.daoAppID, 'deposit') ?? 0n;
    voterAcc.setLocalState(this.daoAppID, 'deposit', senderDeposit + BigInt(amount));
    this.syncAccounts();
  }

  vote (voterAcc, voteType, proposalLsigAcc) {
    const proposalID = proposalLsigAcc.getLocalState(this.daoAppID, 'id');
    const key = new Uint8Array([...parsing.stringToBytes('p_'), ...parsing.addressToPk(proposalLsigAcc.address)]);
    voterAcc.setLocalState(this.daoAppID, key, proposalID);

    const yesVotes = proposalLsigAcc.getLocalState(this.daoAppID, 'yes') ?? 0n;
    const noVotes = proposalLsigAcc.getLocalState(this.daoAppID, 'no') ?? 0n;
    const abstainVotes = proposalLsigAcc.getLocalState(this.daoAppID, 'abstain') ?? 0n;
    const senderDeposit = voterAcc.getLocalState(this.daoAppID, 'deposit') ?? 0n;

    switch (voteType) {
      case Vote.YES:
        proposalLsigAcc.setLocalState(this.daoAppID, 'yes', yesVotes + senderDeposit);
        break;
      case Vote.NO:
        proposalLsigAcc.setLocalState(this.daoAppID, 'no', noVotes + senderDeposit);
        break;
      case Vote.ABSTAIN:
        proposalLsigAcc.setLocalState(this.daoAppID, 'abstain', abstainVotes + senderDeposit);
        break;
      default:
        break;
    }

    const depositLock = voterAcc.getLocalState(this.daoAppID, 'deposit_lock') ?? 0n;
    const votingEnd = proposalLsigAcc.getLocalState(this.daoAppID, 'voting_end');
    if (depositLock <= votingEnd) {
      voterAcc.setLocalState(this.daoAppID, 'deposit_lock', votingEnd);
    }
    this.syncAccounts();
  }

  executeProposal (proposalLsigAcc) {
    proposalLsigAcc.setLocalState(this.daoAppID, 'executed', 1n);
    this.syncAccounts();
  }
}

module.exports = {
  Context,
  minBalance,
  initialBalance,
  minSupport,
  deposit
};
