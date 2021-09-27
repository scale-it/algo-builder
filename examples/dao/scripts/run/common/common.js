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

module.exports = {
  fundAccount,
  ProposalType,
  Vote,
  tryExecuteTx
};
