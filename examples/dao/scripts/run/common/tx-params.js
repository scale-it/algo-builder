const { types } = require('@algo-builder/web');
const { ProposalType, DAOActions, ExampleProposalConfig } = require('./common');

const now = Math.round(new Date().getTime() / 1000);

const votingStart = now + (1 * 60);
const votingEnd = now + (3 * 60);
const executeBefore = now + (7 * 60);

function mkProposalTx (
  daoAppID, govTokenID, proposerAcc, depositLsig, proposalLsig, daoFundLsig) {
  const proposerAddr = proposerAcc.addr ?? proposerAcc.address;
  const proposalParams = [
    DAOActions.addProposal,
    `str:${ExampleProposalConfig.name}`, // name
    `str:${ExampleProposalConfig.URL}`, // url
    `str:${ExampleProposalConfig.URLHash}`, // url_hash
    'str:', // hash_algo (passing null)
    `int:${votingStart}`, // voting_start (now + 1min)
    `int:${votingEnd}`, // voting_end (now + 3min)
    `int:${executeBefore}`, // execute_before (now + 7min)
    `int:${ProposalType.ALGO_TRANSFER}`, // type
    `addr:${daoFundLsig.address()}`, // from (DAO treasury)
    `addr:${proposerAddr}`, // recepient
    `int:${2e6}` // amount (in microalgos)
  ];

  return [
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: proposalLsig.address(),
      appID: daoAppID,
      lsig: proposalLsig,
      payFlags: {},
      appArgs: proposalParams
    },
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: proposerAcc, // note: this can be any account
      toAccountAddr: depositLsig.address(),
      amount: 10, // (fails) as deposit is set as 15
      assetID: govTokenID,
      payFlags: { totalFee: 1000 }
    }
  ];
};

function mkDepositVoteTokenTx (daoAppID, govTokenID, voterAcc, depositLsig, amount) {
  return [
    // tx0: call to DAO App with arg 'deposit_vote_token'
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: voterAcc,
      appID: daoAppID,
      payFlags: { totalFee: 1000 },
      appArgs: [DAOActions.depositVoteToken]
    },
    // tx1: deposit votes (each token == 1 vote)
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: voterAcc, // note: this can be any account
      toAccountAddr: depositLsig.address(),
      amount: amount,
      assetID: govTokenID,
      payFlags: { totalFee: 1000 }
    }
  ];
};

function mkWithdrawVoteDepositTx (daoAppID, govTokenID, voterAcc, depositLsig, amount) {
  return [
    // tx0: call to DAO App with arg 'withdraw_vote_deposit'
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: voterAcc,
      appID: daoAppID,
      payFlags: { totalFee: 2000 },
      appArgs: [DAOActions.withdrawVoteDeposit]
    },
    // tx1: withdraw votes from deposit_lsig back to voter
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: depositLsig.address(),
      toAccountAddr: voterAcc.addr,
      amount: amount,
      lsig: depositLsig,
      assetID: govTokenID,
      payFlags: { totalFee: 0 } // fees paid by voterAcc in tx0
    }
  ];
};

function mkClearVoteRecordTx (daoAppID, voterAcc, proposalAddr) {
  return {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: voterAcc,
    appID: daoAppID,
    payFlags: { totalFee: 1000 },
    appArgs: [DAOActions.clearVoteRecord],
    accounts: [proposalAddr]
  };
};

function mkClearProposalTx (
  daoAppID, govTokenID, depositLsig, proposalLsig, depositAmt) {
  return [
    // tx0: call to DAO App with arg 'clear_proposal'
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: proposalLsig.address(),
      appID: daoAppID,
      lsig: proposalLsig,
      payFlags: { totalFee: 2000 },
      appArgs: [DAOActions.clearProposal]
    },
    // tx1: withdraw deposit from deposit_lsig back to proposalLsig
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: depositLsig.address(),
      toAccountAddr: proposalLsig.address(),
      amount: depositAmt,
      lsig: depositLsig,
      assetID: govTokenID,
      payFlags: { totalFee: 0 } // fees paid by proposalLsig in tx0
    }
  ];
};

module.exports = {
  mkProposalTx,
  mkDepositVoteTokenTx,
  mkWithdrawVoteDepositTx,
  mkClearVoteRecordTx,
  mkClearProposalTx,
  now,
  votingStart,
  votingEnd,
  executeBefore
};
