const { executeTransaction, TransactionType, SignType, base64ToBytes } = require('@algorand-builder/algob');

/**
* Description: Converts Integer into Bytes Array
*/
function getInt64Bytes (x) {
  const y = Math.floor(x / 2 ** 32);
  const byt = [y, (y << 8), (y << 16), (y << 24), x, (x << 8), (x << 16), (x << 24)].map(z => z >>> 24);
  return new Uint8Array(byt);
}

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const alice = deployer.accountsByName.get('alice');
  const votingAdminAccount = deployer.accountsByName.get('john');

  const algoTxnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
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
    type: TransactionType.TransferAsset,
    sign: SignType.SecretKey,
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
    getInt64Bytes(regBegin),
    getInt64Bytes(regEnd),
    getInt64Bytes(voteBegin),
    getInt64Bytes(voteEnd),
    getInt64Bytes(assetID)
  ];

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
  const reg = [base64ToBytes('register')];

  console.log('Opting-In for Alice in voting application');
  try {
    await deployer.optInToSSC(alice, res.appID, {}, { appArgs: reg });
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
}

module.exports = { default: run };
