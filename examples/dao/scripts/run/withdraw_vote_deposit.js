const { executeTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts, getDepositLsig } = require('./common/accounts.js');

async function withdrawVoteDeposit (deployer, voterAcc, amt) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  const govToken = deployer.asa.get('gov-token');
  const depositLsig = await getDepositLsig(deployer);

  console.log(`* Withrawing ${amt} votes by ${voterAcc.addr} *`);
  const withdrawVoteParam = [
    // tx0: call to DAO App with arg 'withdraw_vote_deposits'
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: voterAcc,
      appID: daoAppInfo.appID,
      payFlags: { totalFee: 2000 },
      appArgs: ['str:withdraw_vote_deposit']
    },
    // tx1: withdraw votes from deposit_lsig back to voter
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: depositLsig.address(),
      toAccountAddr: voterAcc.addr,
      amount: amt,
      lsig: depositLsig,
      assetID: govToken.assetIndex,
      payFlags: { totalFee: 0 } // fees paid by voterAcc in tx0
    }
  ];

  await executeTx(deployer, withdrawVoteParam);
}

async function run (runtimeEnv, deployer) {
  const { _, __, voterA, voterB } = accounts(deployer);

  // withdraw deposited votes by voterA & voterB (in ./deposit_vote.js)
  await withdrawVoteDeposit(deployer, voterA, 6);
  await withdrawVoteDeposit(deployer, voterB, 8);

  // Transaction FAIL: withdrawing votes again would result in negative no.
  await withdrawVoteDeposit(deployer, voterA, 6);
}

module.exports = { default: run };
