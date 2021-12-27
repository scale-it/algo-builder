const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

async function tryExecuteTx (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e);
  }
};

/**
 * Fund accounts from master with 20 Algos
 * @param {*} deployer algobDeployer
 * @param {*} accounts account or list of accounts to fund
 */
async function fundAccount (deployer, accounts) {
  const master = deployer.accountsByName.get('master-account');
  const params = [];
  if (!(accounts instanceof Array)) {
    accounts = [accounts];
  }
  for (const a of accounts) {
    console.log(`* Funding Account: ${a.name} *`);
    params.push({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master,
      toAccountAddr: a.addr,
      amountMicroAlgos: 20e6,
      payFlags: { totalFee: 1000, note: 'funding account' }
    });
  }

  try {
    await executeTransaction(deployer, params);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error.text : e);
  }
};

const ProposalType = {
  ALGO_TRANSFER: 1,
  ASA_TRANSFER: 2,
  MESSAGE: 3
};

const Vote = {
  YES: 'yes',
  NO: 'no',
  ABSTAIN: 'abstain'
};

const DAOActions = {
  addProposal: 'str:add_proposal',
  depositVoteToken: 'str:deposit_vote_token',
  registerVote: 'str:register_vote',
  execute: 'str:execute',
  withdrawVoteDeposit: 'str:withdraw_vote_deposit',
  clearVoteRecord: 'str:clear_vote_record',
  clearProposal: 'str:clear_proposal'
};

const ExampleProposalConfig = {
  name: 'my-custom-proposal',
  URL: 'www.myurl.com',
  URLHash: 'url-hash'
};

module.exports = {
  fundAccount,
  ProposalType,
  Vote,
  DAOActions,
  ExampleProposalConfig,
  tryExecuteTx
};
