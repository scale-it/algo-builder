const {
  executeTransaction, convert, readGlobalStateSSC, balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const creatorAccount = deployer.accountsByName.get('john');
  const storeManagerAccount = deployer.accountsByName.get('alice');

  const asaInfo = deployer.getASAInfo('bond-token');
  const appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  let scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: creatorAccount.addr
  };
  const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);

  const deployTx = {
    type: types.TransactionType.DeployASA,
    sign: types.SignType.SecretKey,
    fromAccount: creatorAccount,
    asaName: 'new-bond-token',
    payFlags: {}
  };
  // Create B_[i+1]
  const newAsaInfo = await executeTransaction(deployer, deployTx);
  console.log(newAsaInfo);
  const newIndex = newAsaInfo['asset-index'];

  await deployer.optInLsigToASA(newIndex, issuerLsig, { totalFee: 1000 });

  scInitParam = {
    TMPL_OLD_BOND: asaInfo.assetIndex,
    TMPL_NEW_BOND: newIndex,
    TMPL_APPLICATION_ID: appInfo.appID
  };
  const dexLsig = await deployer.loadLogic('dex-lsig.py', scInitParam);

  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: dexLsig.address(),
    amountMicroAlgos: 200000000,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);
  await deployer.optInLsigToASA(newIndex, dexLsig, { totalFee: 1000 });

  const globalState = await readGlobalStateSSC(deployer, storeManagerAccount.addr, appInfo.appID);
  let total = 0;
  for (const l of globalState) {
    const key = Buffer.from(l.key, 'base64').toString();
    if (key === 'total') {
      total = l.value.uint;
      break;
    }
  }

  // Transfer total amount to dex lsig
  const transferTx = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: creatorAccount,
    toAccountAddr: dexLsig.address(),
    amount: total,
    assetID: newIndex,
    payFlags: { totalFee: 1000 }
  };
  await executeTransaction(deployer, transferTx);

  // balance of old bond tokens in issuer lsig
  const info = await balanceOf(deployer, issuerLsig.address(), asaInfo.assetIndex);
  console.log('Old balance amount ', info.amount);
  const groupTx = [
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: storeManagerAccount,
      appID: appInfo.appID,
      payFlags: {},
      appArgs: ['str:create_dex'],
      accounts: [issuerLsig.address()]
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
    }
  ];

  console.log('Creating dex!');
  await executeTransaction(deployer, groupTx);
  console.log('Dex created!');
}

module.exports = { default: run };
