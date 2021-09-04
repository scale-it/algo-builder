const _getScInitParam = (deployer) => {
  const govToken = deployer.asa.get('gov-token');
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  return {
    TMPL_GOV_TOKEN: govToken.assetIndex,
    TMPL_DAO_APP_ID: daoAppInfo.appID
  };
};

// returns deposit_lsig
async function getDepositLsig (deployer) {
  return await deployer.loadLogic('deposit-lsig.py', _getScInitParam(deployer));
};

// returns vote_deposit lsig
async function getDAOFundLsig (deployer) {
  return await deployer.loadLogic('dao-fund-lsig.py', _getScInitParam(deployer));
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
  accounts
};
