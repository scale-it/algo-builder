const { executeTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts } = require('./common/accounts.js');

async function clearVoteRecord (deployer, voterAcc, proposalLsig) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');

  console.log(`* Clearing vote record of ${voterAcc.addr} from proposal ${proposalLsig.address()} *`);
  const withdrawVoteParam = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: voterAcc,
    appID: daoAppInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:clear_vote_record'],
    accounts: [proposalLsig.address()]
  };

  await executeTx(deployer, withdrawVoteParam);
}

async function run (runtimeEnv, deployer) {
  const { _, __, voterA, voterB } = accounts(deployer);
  const proposalLsig = await deployer.loadLogic('proposal-lsig.py');

  // withdraw deposited votes by voterA & voterB (in ./deposit_vote.js)
  await clearVoteRecord(deployer, voterA, proposalLsig);
  await clearVoteRecord(deployer, voterB, proposalLsig);
}

module.exports = { default: run };
