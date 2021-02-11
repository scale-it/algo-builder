const {
  executeTransaction
} = require('@algorand-builder/algob');
const { types } = require('@algorand-builder/runtime');

async function run (runtimeEnv, deployer) {
  const master = deployer.accountsByName.get('master-account');
  const creator = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  /** Fund Creator account by master **/
  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: master,
    toAccountAddr: creator.addr,
    amountMicroAlgos: 200e6,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);

  const asaInfo = await deployer.deployASA('gold', { creator: creator });
  console.log(asaInfo);

  /** * Creating Application ***/
  // initialize app arguments
  const appArgs = [
    `int:${asaInfo.assetIndex}`,
    'int:2' // set min user level(2) for asset transfer ("Accred-level")
  ];

  const res = await deployer.deploySSC(
    'poi.teal', // approval program
    'poi-clear.teal', // clear program
    {
      sender: creator,
      localInts: 1,
      localBytes: 0,
      globalInts: 2,
      globalBytes: 1,
      appArgs: appArgs
    }, {});

  console.log(res);

  const appId = res.appID;
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
