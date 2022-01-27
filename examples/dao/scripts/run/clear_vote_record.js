import { accounts, getProposalLsig } from './common/accounts.js';
import { tryExecuteTx } from './common/common.js';
import { mkClearVoteRecordTx } from './common/tx-params.js';

async function clearVoteRecord (deployer, voterAcc, proposalAddr) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');

  console.log(`* Clearing vote record of ${voterAcc.addr} from proposal ${proposalAddr} *`);
  const clearVoteParams = mkClearVoteRecordTx(
    daoAppInfo.appID,
    voterAcc,
    proposalAddr
  );
  await tryExecuteTx(deployer, clearVoteParams);
}

async function run (runtimeEnv, deployer) {
  const { _, __, voterA, voterB } = accounts(deployer);
  const proposalLsig = await getProposalLsig(deployer);

  // withdraw deposited votes by voterA & voterB (in ./deposit_vote_token.js)
  await clearVoteRecord(deployer, voterA, proposalLsig.address());
  await clearVoteRecord(deployer, voterB, proposalLsig.address());
}

module.exports = { default: run };
