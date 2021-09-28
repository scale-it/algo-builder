const { fundAccount, ProposalType, tryExecuteTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts, getDAOFundLsig, getDepositLsig, getProposalLsig } = require('./common/accounts.js');
const { getAddProposalTx } = require('./common/tx-params.js');

const now = Math.round(new Date().getTime() / 1000);

async function addProposal (runtimeEnv, deployer) {
  const { _, proposer } = accounts(deployer);

  // fund account
  await fundAccount(deployer, proposer);

  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  const proposalLsig = await getProposalLsig(deployer);
  try {
    await deployer.optInLsigToApp(daoAppInfo.appID, proposalLsig, {}, {});
  } catch (e) {
    console.log(e.message);
  }

  const daoFundLsig = await getDAOFundLsig(deployer);
  const depositLsig = await getDepositLsig(deployer);
  const govToken = deployer.asa.get('gov-token');

  const addProposalTx = getAddProposalTx(
    daoAppInfo.appID,
    govToken.assetIndex,
    proposer,
    depositLsig,
    proposalLsig,
    daoFundLsig
  );

  // Transaction FAIL (asset_transfer amount is less than min_deposit)
  await tryExecuteTx(deployer, addProposalTx);

  // Transaction PASS
  addProposalTx[1].amount = 15; // deposit is set as 15 in DAO App
  await tryExecuteTx(deployer, addProposalTx);
}

module.exports = { default: addProposal };
