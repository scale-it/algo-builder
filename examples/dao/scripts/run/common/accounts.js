const _appInitParams = (deployer) => {
  const govToken = deployer.asa.get('gov-token');
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  return {
    ARG_GOV_TOKEN: govToken.assetIndex,
    ARG_DAO_APP_ID: daoAppInfo.appID
  };
};

// returns deposit_lsig
async function getDepositLsig (deployer) {
  return await deployer.loadLogic('deposit-lsig.py', _appInitParams(deployer));
};

// returns vote_deposit lsig
async function getDAOFundLsig (deployer) {
  return await deployer.loadLogic('dao-fund-lsig.py', _appInitParams(deployer));
};

// returns proposal lsig
async function getProposalLsig (deployer) {
  const proposerAcc = accounts(deployer).proposer;
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  return await deployer.loadLogic('proposal-lsig.py',
    { ARG_OWNER: proposerAcc.addr, ARG_DAO_APP_ID: daoAppInfo.appID });
};

/**
 * This function loads accounts from deployer
 * @param deployer deployer object
 */
function accounts (deployer) {
  return {
    creator: deployer.accountsByName.get('john'),
    proposer: deployer.accountsByName.get('bob'),
    voterA: deployer.accountsByName.get('elon-musk'),
    voterB: deployer.accountsByName.get('alice')
  };
};

module.exports = {
  getDepositLsig,
  getDAOFundLsig,
  getProposalLsig,
  accounts
};
