const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { accounts } = require('./common/accounts.js');
const { issuePrice, tokenMap } = require('./common/common.js');
const { redeem } = require('./redeem.js');

/**
 * In this function Elon redeems his 8 bonds, and
 * Elon buys 4 more bonds (so he will have 12 bonds in total)
 * @param deployer deployer object
 */
exports.epoch1 = async function (deployer) {
  const account = await accounts(deployer);

  // Redeem 8 bonds
  await redeem(deployer, account.elon, account.manager, 1, 8);
  console.log('Elon redeemed 8 bonds from dex_1');

  const appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: account.creator.addr,
    TMPL_APP_MANAGER: account.manager.addr
  };
  const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);
  const bondToken = tokenMap.get('bond-token-1');
  await deployer.optInAcountToASA(bondToken, 'bob', { totalFee: 1000 });
  await deployer.optInAcountToASA(bondToken, 'elon-musk', { totalFee: 1000 });

  // elon buys 4 bonds
  const algoAmount = 4 * issuePrice;

  const groupTx = [
    // Algo transfer from buyer to issuer
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: account.elon,
      toAccountAddr: issuerLsig.address(),
      amountMicroAlgos: algoAmount,
      payFlags: { totalFee: 2000 }
    },
    // Bond token transfer from issuer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: issuerLsig.address(),
      lsig: issuerLsig,
      toAccountAddr: account.elon.addr,
      amount: 4,
      assetID: bondToken,
      payFlags: { totalFee: 0 }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: account.elon,
      appID: appInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:buy']
    }
  ];

  console.log('Elon buying 4 more bonds!');
  await executeTransaction(deployer, groupTx);
  console.log('Elon bought 4 more bonds!');
};
