const {
  executeTransaction
} = require('@algo-builder/algob');

const { issueTx } = require('./common/common');
/**
 * In this function tokens are issued to issuer from token creator.
 * @param deployer deployer
 */
exports.issue = async function (deployer) {
  const creatorAccount = deployer.accountsByName.get('john');
  const managerAcc = deployer.accountsByName.get('alice');

  const appInfo = deployer.getAppByFile('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: creatorAccount.addr,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const issuerLsig = await deployer.loadLogicByFile('issuer-lsig.py', scInitParam);
  const asaInfo = deployer.getASAInfo('bond-token-0');
  const groupTx = issueTx(creatorAccount, issuerLsig, appInfo.appID, asaInfo.assetIndex);

  console.log('Issuing tokens!');
  await executeTransaction(deployer, groupTx);
  console.log('Tokens issued to issuer');
};
