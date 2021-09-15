const { executeTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts, getProposalLsig } = require('./common/accounts.js');

async function clearVoteRecord (deployer, voterAcc, proposalAddr) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');

  console.log(`* Clearing vote record of ${voterAcc.addr} from proposal ${proposalAddr} *`);
  const clearVoteParams = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: voterAcc,
    appID: daoAppInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:clear_vote_record'],
    accounts: [proposalAddr]
  };

  await executeTx(deployer, clearVoteParams);
}

async function run (runtimeEnv, deployer) {
  const { _, __, voterA, voterB } = accounts(deployer);
  const proposalLsig = await getProposalLsig(deployer);

  // withdraw deposited votes by voterA & voterB (in ./deposit_vote.js)
  await clearVoteRecord(deployer, voterA, proposalLsig.address());
  await clearVoteRecord(deployer, voterB, proposalLsig.address());
}

module.exports = { default: run };
