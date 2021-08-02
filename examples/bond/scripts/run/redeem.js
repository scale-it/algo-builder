const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { tokenMap, couponValue } = require('./common/common.js');

/**
 * Redeem old tokens, get coupon_value + new bond tokens
 * @param deployer deployer object
 * @param buyerAccount buyer account
 * @param managerAcc manager account
 * @param dex dex number from which you want to make a redemption
 * @param amount bond amount
 * For ex: 1 means your 0 bond-tokens will be redeemed from 1st Dex
 */
exports.redeem = async function (deployer, buyerAccount, managerAcc, dex, amount) {
  const appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  const oldBond = tokenMap.get('bond-token-' + String(dex - 1));
  const newBond = tokenMap.get('bond-token-' + String(dex));
  const scInitParam = {
    TMPL_OLD_BOND: oldBond,
    TMPL_NEW_BOND: newBond,
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const dexLsig = await deployer.loadLogic('dex-lsig.py', scInitParam);
  await deployer.optInAcountToASA(newBond, buyerAccount.name, {});
  const groupTx = [
    // Transfer tokens to dex lsig.
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      toAccountAddr: dexLsig.address(),
      amount: amount,
      assetID: oldBond,
      payFlags: { totalFee: 3000 }
    },
    // New bond token transfer to buyer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.addr,
      amount: amount,
      assetID: newBond,
      payFlags: { totalFee: 0 }
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.addr,
      amountMicroAlgos: Number(amount) * Number(couponValue),
      payFlags: { totalFee: 0 }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      appID: appInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:redeem_coupon']
    }
  ];

  console.log(`* Redeeming ${amount} tokens for ${buyerAccount.name} from Dex: ${dex}!`);
  await executeTransaction(deployer, groupTx);
  console.log('Tokens redeemed!');
};
