const {
  executeTransaction, readGlobalStateSSC, balanceOf
} = require('@algo-builder/algob');
const { asaDef, fundAccount } = require('./common/common.js');
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
  const asaInfo = deployer.getASAInfo(previousToken);
  const appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: creatorAccount.addr,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);
  console.log('Issuer address: ', issuerLsig.address());
  const newBondToken = 'bond-token-' + String(i);
  console.log(asaDef, newBondToken);
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

  // move to commmon
  // Only store manager can allow opt-in to ASA for lsig
  const optInTx = [
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: managerAcc,
      toAccountAddr: issuerLsig.address(),
      amountMicroAlgos: 0,
      payFlags: {}
    },
    {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: issuerLsig.address(),
      lsig: issuerLsig,
      assetID: newIndex,
      payFlags: {}
    }
  ];
  await executeTransaction(deployer, optInTx);

  const lsigParams = {
    TMPL_OLD_BOND: asaInfo.assetIndex,
    TMPL_NEW_BOND: newIndex,
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const dexLsig = await deployer.loadLogic('dex-lsig.py', lsigParams);

  await fundAccount(deployer, dexLsig.address());

  optInTx[0].toAccountAddr = dexLsig.address();
  optInTx[1].fromAccountAddr = dexLsig.address();
  optInTx[1].lsig = dexLsig;
  await executeTransaction(deployer, optInTx);

  optInTx[1].assetID = asaInfo.assetIndex;
  await executeTransaction(deployer, optInTx);

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
  const info = await balanceOf(deployer, issuerLsig.address(), asaInfo.assetIndex);
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
      assetID: asaInfo.assetIndex,
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
      amount: 200,
      payFlags: { totalFee: 1000 }
    }
  ];

  console.log('Creating dex!');
  await executeTransaction(deployer, groupTx);
  console.log('Dex created!');
};
