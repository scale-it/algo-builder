const { fundAccount, ProposalType, executeTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts, getDAOFundLsig, getDepositLsig } = require('./common/accounts.js');

const now = Math.round(new Date().getTime() / 1000);

async function addProposal (runtimeEnv, deployer) {
  const { _, proposer } = accounts(deployer);

  // fund account
  await fundAccount(deployer, proposer);

  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  const proposalLsig = await deployer.loadLogic('proposal-lsig.py');
  try {
    await deployer.optInLsigToApp(daoAppInfo.appID, proposalLsig, {}, {});
  } catch (e) {
    console.log(e.message);
  }

  const daoFundLsig = await getDAOFundLsig(deployer);
  const daoParams = [
    'str:add_proposal',
    'str:my-custom-proposal', // name
    'str:www.myurl.com', // url
    'str:url-hash', // url_hash
    'str:', // hash_algo (passing null)
    `int:${now + 10}`, // voting_start (now + 10s)
    `int:${now + (2 * 60)}`, // voting_end (now + 2min)
    `int:${now + (5 * 60)}`, // execute_before (now + 5min)
    `int:${ProposalType.ALGO_TRANSFER}`, // type
    `addr:${daoFundLsig.address()}`, // from (DAO treasury)
    `addr:${proposer.addr}`, // recepient
    `int:${2e6}` // amount (in microalgos)
  ];

  const depositLsig = await getDepositLsig(deployer);
  const govToken = deployer.asa.get('gov-token');
  const addProposalTx = [
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: proposalLsig.address(),
      appID: daoAppInfo.appID,
      lsig: proposalLsig,
      payFlags: {},
      appArgs: appArgs
    },
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: proposer, // note: this can be any account
      toAccountAddr: depositLsig.address(),
      amount: 15, // deposit is set as 15
      assetID: govToken.assetIndex,
      payFlags: { totalFee: 1000 }
    }
  ];

  // Transaction PASS
  await executeTx(deployer, groupTx);

  // Transaction FAIL (asset_transfer amount is less than min_deposit)
  groupTx[1].amount = 10;
  await executeTx(deployer, groupTx);
}

module.exports = { default: addProposal };
