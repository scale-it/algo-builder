const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

/**
 * In this function tokens are issued to issuer from token creator.
 * @param deployer deployer
 */
exports.issue = async function (deployer) {
  const creatorAccount = deployer.accountsByName.get('john');
  const managerAcc = deployer.accountsByName.get('alice');

  const appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: creatorAccount.addr,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);
  const asaInfo = deployer.getASAInfo('bond-token-0');
  const groupTx = [
    // Bond asa transfer to issuer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      toAccountAddr: issuerLsig.address(),
      amount: 1e6,
      assetID: asaInfo.assetIndex,
      payFlags: { }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      appID: appInfo.appID,
      payFlags: {},
      appArgs: ['str:issue']
    }
  ];

  console.log('Issuing tokens!');
  await executeTransaction(deployer, groupTx);
  console.log('Tokens issued to issuer');
};
