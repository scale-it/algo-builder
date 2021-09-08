const { executeTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts, getDepositLsig } = require('./common/accounts.js');

async function depositVote (deployer, voterAcc, amt) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  const govToken = deployer.asa.get('gov-token');
  const depositLsig = await getDepositLsig(deployer);

  // opt-in to App by voterAcc
  try {
    await deployer.optInAccountToApp(voterAcc, daoAppInfo.appID, {}, {});
  } catch (e) {
    console.log(e.message); // already opted in
  }

  console.log(`* Deposit ${amt} votes by ${voterAcc.addr} *`);
  const depositVoteParam = [
    // tx0: call to DAO App with arg 'deposit_vote'
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: voterAcc,
      appID: daoAppInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:deposit_vote']
    },
    // tx1: deposit votes (each token == 1 vote)
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: voterAcc, // note: this can be any account
      toAccountAddr: depositLsig.address(),
      amount: amt,
      assetID: govToken.assetIndex,
      payFlags: { totalFee: 1000 }
    }
  ];

  await executeTx(deployer, depositVoteParam);
}

async function run (runtimeEnv, deployer) {
  const { _, __, voterA, voterB } = accounts(deployer);

  // deposit votes by voterA & voterB
  await depositVote(deployer, voterA, 6);
  await depositVote(deployer, voterB, 8);
}

module.exports = { default: run };
