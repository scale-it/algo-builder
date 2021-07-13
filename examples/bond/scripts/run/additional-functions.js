const {
  executeTransaction, convert, readGlobalStateSSC, balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

let newAsaInfo;
let appInfo;
let asaInfo;
const assetID = 'asset-index';

/**
 * Creates DEX_i lsig, burn B_i tokens, issue B_i+1 tokens
 * @param {Account} masterAccount
 * @param {Account} creatorAccount
 * @param {Account} storeManagerAccount
 */
async function createDex (deployer, masterAccount, creatorAccount, storeManagerAccount) {
  asaInfo = deployer.getASAInfo('bond-token');
  appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  let scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: creatorAccount.addr,
    TMPL_STORE_MANAGER: storeManagerAccount.addr
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
  newAsaInfo = await executeTransaction(deployer, deployTx);
  console.log(newAsaInfo);
  const newIndex = newAsaInfo[assetID];

  // Only store manager can allow opt-in to ASA for lsig
  const optInTx = [
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: storeManagerAccount,
      toAccountAddr: issuerLsig.address(),
      amountMicroAlgos: 0,
      payFlags: {}
    },
    {
      types: types.TransactionType.OptInToASA,
      sign: types.TransactionType.SecretKey,
      fromAccountAddr: issuerLsig.address(),
      lsig: issuerLsig,
      assetID: newIndex,
      payFlags: {}
    }
  ];
  await executeTransaction(deployer, optInTx);

  scInitParam = {
    TMPL_OLD_BOND: asaInfo.assetIndex,
    TMPL_NEW_BOND: newIndex,
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_STORE_MANAGER: storeManagerAccount.addr
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

  optInTx[0].toAccountAddr = dexLsig.address();
  optInTx[1].fromAccountAddr = dexLsig.address();
  optInTx[1].lsig = dexLsig;
  await executeTransaction(deployer, optInTx);

  optInTx[1].assetID = asaInfo.assetIndex;
  await executeTransaction(deployer, optInTx);

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
      appArgs: ['str:createDex'],
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

/**
 * Redeem old tokens, get coupon_value + new bond tokens
 * @param {Account} buyerAccount
 */
async function redeem (deployer, buyerAccount) {
  const scInitParam = {
    TMPL_OLD_BOND: asaInfo.assetIndex,
    TMPL_NEW_BOND: newAsaInfo[assetID],
    TMPL_APPLICATION_ID: appInfo.appID
  };
  const dexLsig = await deployer.loadLogic('dex-lsig.py', scInitParam);
  await deployer.optInAcountToASA(newAsaInfo[assetID], 'bob', {});
  const groupTx = [
    // Transfer tokens to dex lsig.
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      toAccountAddr: dexLsig.address(),
      amount: 10,
      assetID: asaInfo.assetIndex,
      payFlags: { totalFee: 1000 }
    },
    // New bond token transfer to buyer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.addr,
      amount: 10,
      assetID: newAsaInfo[assetID],
      payFlags: { totalFee: 1000 }
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.addr,
      amountMicroAlgos: 1000,
      payFlags: {}
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      appID: appInfo.appID,
      payFlags: {},
      appArgs: ['str:redeem_coupon']
    }
  ];

  console.log('Redeeming tokens!');
  await executeTransaction(deployer, groupTx);
  console.log('Tokens redeemed!');
}

async function createBuyback (deployer, storeManagerAccount) {
  const buybackTx = {

  };
}

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const creatorAccount = deployer.accountsByName.get('john');
  const storeManagerAccount = deployer.accountsByName.get('alice');
  const buyerAccount = deployer.accountsByName.get('bob');

  // Create DEX, burn B_0, issue B_1
  await createDex(deployer, masterAccount, creatorAccount, storeManagerAccount);

  // Redeem coupon_value
  await redeem(deployer, buyerAccount);

  // create buyback
  await createBuyback(deployer, storeManagerAccount);
}

module.exports = { default: run };
