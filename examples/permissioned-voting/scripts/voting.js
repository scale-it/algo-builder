const { executeTransaction, stringToBytes, uint64ToBigEndian } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const alice = deployer.accountsByName.get('alice');
  const votingAdminAccount = deployer.accountsByName.get('john');

  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: votingAdminAccount.addr,
    amountMicroAlgos: 200000000,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);

  algoTxnParams.toAccountAddr = alice.addr;
  await executeTransaction(deployer, algoTxnParams);

  // Create ASA - Vote Token
  const asaInfo = await deployer.deployASA('vote-token', { creator: votingAdminAccount });
  console.log(asaInfo);

  // Transfer 1 vote token to alice.
  const txnParam = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: votingAdminAccount,
    toAccountAddr: alice.addr,
    amount: 1,
    assetID: asaInfo.assetIndex,
    payFlags: { note: 'Sending Vote Token' }
  };
  await executeTransaction(deployer, txnParam);

  // Get last round and Initialize rounds
  const status = await deployer.algodClient.status().do();
  console.log('Last Round: ', status['last-round']);
  const regBegin = status['last-round'];
  const regEnd = regBegin + 10;
  const voteBegin = regBegin + 2;
  const voteEnd = voteBegin + 1000;

  // store asset Id of vote token created in this script
  const assetID = asaInfo.assetIndex;
  const appArgs = [
    regBegin,
    regEnd,
    voteBegin,
    voteEnd,
    assetID
  ].map(uint64ToBigEndian);

  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  const res = await deployer.deploySSC(
    'permissioned-voting-approval.py',
    'permissioned-voting-clear.py', {
      sender: votingAdminAccount,
      localInts: 0,
      localBytes: 1,
      globalInts: 6,
      globalBytes: 1,
      appArgs: appArgs
    }, {});

  console.log(res);

  // Register Alice in voting application
  const reg = [stringToBytes('register')];

  console.log('Opting-In for Alice in voting application');
  try {
    await deployer.optInAccountToSSC(alice, res.appID, {}, { appArgs: reg });
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
}

module.exports = { default: run };
