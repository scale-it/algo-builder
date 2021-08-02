const {
  executeTransaction, readGlobalStateSSC, balanceOf
} = require('@algo-builder/algob');
const { asaDef, fundAccount, tokenMap, optInTx, couponValue } = require('./common/common.js');
const { types } = require('@algo-builder/web');

/**
 * Creates DEX_i lsig, burn B_i tokens, issue B_i+1 tokens
 * @param {Account} masterAccount
 * @param {Account} creatorAccount
 * @param {Account} managerAcc
 */
exports.createDex = async function (deployer, creatorAccount, managerAcc, i) {
  if (i < 1) {
    throw new Error('i must be greater than equal to 1');
  }
  const previousToken = 'bond-token-' + String(i - 1);
  const oldBond = tokenMap.get(previousToken);
  const appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: creatorAccount.addr,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);
  console.log('Issuer address: ', issuerLsig.address());
  const newBondToken = 'bond-token-' + String(i);
  const deployTx = {
    type: types.TransactionType.DeployASA,
    sign: types.SignType.SecretKey,
    fromAccount: creatorAccount,
    asaName: newBondToken,
    asaDef: asaDef,
    payFlags: {}
  };
  // Create B_[i+1]
  const newAsaInfo = await executeTransaction(deployer, deployTx);
  console.log(newAsaInfo);
  const newIndex = newAsaInfo['asset-index'];
  tokenMap.set(newBondToken, newIndex);

  // move to commmon
  // Only store manager can allow opt-in to ASA for lsig
  await optInTx(deployer, managerAcc, issuerLsig, newIndex);

  const lsigParams = {
    TMPL_OLD_BOND: oldBond,
    TMPL_NEW_BOND: newIndex,
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const dexLsig = await deployer.loadLogic('dex-lsig.py', lsigParams);

  await fundAccount(deployer, dexLsig.address());

  await optInTx(deployer, managerAcc, dexLsig, newIndex);
  await optInTx(deployer, managerAcc, dexLsig, oldBond);

  const globalState = await readGlobalStateSSC(deployer, managerAcc.addr, appInfo.appID);
  let total = 0;
  for (const l of globalState) {
    const key = Buffer.from(l.key, 'base64').toString();
    if (key === 'total') {
      total = l.value.uint;
      break;
    }
  }
  console.log('Total issued: ', total);

  // balance of old bond tokens in issuer lsig
  const info = await balanceOf(deployer, issuerLsig.address(), oldBond);
  console.log('Old balance amount ', info.amount);
  const groupTx = [
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: managerAcc,
      appID: appInfo.appID,
      payFlags: {},
      appArgs: ['str:create_dex'],
      accounts: [issuerLsig.address(), dexLsig.address()]
    },
    // New bond token transfer to issuer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      toAccountAddr: issuerLsig.address(),
      amount: info.amount,
      assetID: newIndex,
      payFlags: { totalFee: 1000 }
    },
    // burn tokens
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: issuerLsig.address(),
      lsig: issuerLsig,
      toAccountAddr: creatorAccount.addr,
      amount: info.amount,
      assetID: oldBond,
      payFlags: { totalFee: 1000 }
    },
    // Transfer app.total amount of new Bonds to dex lsig
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      toAccountAddr: dexLsig.address(),
      amount: total,
      assetID: newIndex,
      payFlags: { totalFee: 1000 }
    },
    // Algo transfer to dex address
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      toAccountAddr: dexLsig.address(),
      amountMicroAlgos: Number(total) * Number(couponValue),
      payFlags: { totalFee: 1000 }
    }
  ];

  console.log(`* Creating dex ${i}! *`);
  await executeTransaction(deployer, groupTx);
  console.log('Dex created!');
  return newIndex;
};
