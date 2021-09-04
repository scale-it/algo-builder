const { executeTx, Vote } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts } = require('./common/accounts.js');

async function registerVote (deployer, voterAcc, proposalLsig, voteType) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');

  console.log(`* Register votes by ${voterAcc.addr} *`);
  // call to DAO app by voter (to register deposited votes)
  const registerVoteParam = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: voterAcc,
    appID: daoAppInfo.appID,
    payFlags: { totalFee: 2000 },
    appArgs: ['str:register_vote', `str:${voteType}`],
    accounts: [proposalLsig.address()]
  };

  await executeTx(deployer, registerVoteParam);
}

async function run (runtimeEnv, deployer) {
  const { _, __, voterA, voterB } = accounts(deployer);
  const proposalLsig = await deployer.loadLogic('proposal-lsig.py');

  // register votes (deposited in ./deposit_vote.js)
  await registerVote(deployer, voterA, proposalLsig, Vote.YES);
  await registerVote(deployer, voterB, proposalLsig, Vote.ABSTAIN);

  // Transaction FAIL: voterA tries to register deposited votes again
  await registerVote(deployer, voterA, proposalLsig, Vote.YES);
}

module.exports = { default: run };
