const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const master = deployer.accountsByName.get('master-account');
  const creator = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  /** Fund Creator & Bob account by master **/
  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: master,
    toAccountAddr: creator.addr,
    amountMicroAlgos: 200e6,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);
  algoTxnParams.toAccountAddr = bob.addr;
  await executeTransaction(deployer, algoTxnParams);

  const asaInfo = await deployer.deployASA('gold', { creator: creator });
  await deployer.optInAcountToASA('gold', 'bob', {}); // asa optIn for bob
  console.log(asaInfo);

  /** * Creating Application ***/
  // initialize app arguments
  const appArgs = [
    `int:${asaInfo.assetIndex}`,
    'int:2' // set min user level(2) for asset transfer ("Accred-level")
  ];

  const sscInfo = await deployer.deploySSC(
    'poi-approval.teal', // approval program
    'poi-clear.teal', // clear program
    {
      sender: creator,
      localInts: 1, // to store level of asset for account
      localBytes: 0,
      globalInts: 2, // 1 to store assetId, 1 for min asset level required to transfer asset
      globalBytes: 1, // to store creator address
      appArgs: appArgs
    }, {});

  console.log(sscInfo);

  const appId = sscInfo.appID;
  console.log('Opting-In for Creator(Alice) and Bob.');
  try {
    await deployer.optInToSSC(creator, appId, {}, {});
    await deployer.optInToSSC(bob, appId, {}, {});
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
  console.log('Opt-In successful.');
}

module.exports = { default: run };
