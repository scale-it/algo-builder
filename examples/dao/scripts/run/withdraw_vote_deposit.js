const { tryExecuteTx } = require('./common/common.js');
const { accounts, getDepositLsig } = require('./common/accounts.js');
const { mkWithdrawVoteDepositTx } = require('./common/tx-params.js');

async function withdrawVoteDeposit (deployer, voterAcc, amt) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  const govToken = deployer.asa.get('gov-token');
  const depositLsig = await getDepositLsig(deployer);

  console.log(`* Withrawing ${amt} votes by ${voterAcc.addr} *`);
  const withdrawVoteParam = mkWithdrawVoteDepositTx(
    daoAppInfo.appID,
    govToken.assetIndex,
    voterAcc,
    depositLsig,
    amt
  );
  await tryExecuteTx(deployer, withdrawVoteParam);
}

async function run (runtimeEnv, deployer) {
  const { _, __, voterA, voterB } = accounts(deployer);

  // withdraw deposited votes by voterA & voterB (in ./deposit_vote_token.js)
  await withdrawVoteDeposit(deployer, voterA, 6);
  await withdrawVoteDeposit(deployer, voterB, 8);

  // Transaction FAIL: withdrawing votes again would result in negative no.
  await withdrawVoteDeposit(deployer, voterA, 6);
}

module.exports = { default: run };
