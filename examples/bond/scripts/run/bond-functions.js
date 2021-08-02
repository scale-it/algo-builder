const {
  executeTransaction, convert, readGlobalStateSSC, balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

let newAsaInfo;
let appInfo;
let asaInfo;
let buybackLsig;
const assetID = 'asset-index';

// fund account using master account
async function fundAccount (deployer, accountAddress) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: accountAddress,
    amountMicroAlgos: 200e6,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);
}

/**
 * Creates DEX_i lsig, burn B_i tokens, issue B_i+1 tokens
 * @param {Account} masterAccount
 * @param {Account} creatorAccount
 * @param {Account} managerAcc
 */
async function createDex (deployer, masterAccount, creatorAccount, managerAcc) {
  asaInfo = deployer.getASAInfo('bond-token-1');
  appInfo = deployer.getApp('bond-dapp-stateful.py', 'bond-dapp-clear.py');
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_OWNER: creatorAccount.addr,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);

  const deployTx = {
    type: types.TransactionType.DeployASA,
    sign: types.SignType.SecretKey,
    fromAccount: creatorAccount,
    asaName: 'bond-token-2',
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
}

/**
 * Redeem old tokens, get coupon_value + new bond tokens
 * @param {Account} buyerAccount
 */
async function redeem (deployer, buyerAccount, managerAcc) {
  const scInitParam = {
    TMPL_OLD_BOND: asaInfo.assetIndex,
    TMPL_NEW_BOND: newAsaInfo[assetID],
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.addr
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
      payFlags: { totalFee: 3000 }
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
      payFlags: { totalFee: 0 }
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.addr,
      amountMicroAlgos: 200,
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

  console.log('Redeeming tokens!');
  await executeTransaction(deployer, groupTx);
  console.log('Tokens redeemed!');
}

/**
 * Create buyback lsig and store it's address in bond-dapp
 * @param {Deployer object} deployer
 * @param {Account} managerAcc
 */
async function createBuyback (deployer, managerAcc) {
  const scInitParam = {
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.addr,
    TMPL_BOND: newAsaInfo[assetID]
  };
  buybackLsig = await deployer.loadLogic('buyback-lsig.py', scInitParam);
  await fundAccount(deployer, buybackLsig.address());

  const buybackTx = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: managerAcc,
    appID: appInfo.appID,
    payFlags: {},
    appArgs: ['str:set_buyback', convert.addressToPk(buybackLsig.address())]
  };

  // Only store manager can allow opt-in to ASA for lsig
  const optInTx = [
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: managerAcc,
      toAccountAddr: buybackLsig.address(),
      amountMicroAlgos: 0,
      payFlags: {}
    },
    {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: buybackLsig.address(),
      lsig: buybackLsig,
      assetID: newAsaInfo[assetID],
      payFlags: {}
    }
  ];
  await executeTransaction(deployer, optInTx);

  console.log('Setting buyback address!');
  await executeTransaction(deployer, buybackTx);
  console.log('Buyback address set successfully!');
}

// Buyer's exit from bond
async function exitBuyer (deployer, buyerAccount) {
  const exitAmount = 10 * 1000 - 1000;
  const exitTx = [
    //  Bond token transfer to buyback address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      toAccountAddr: buybackLsig.address(),
      amount: 10,
      assetID: newAsaInfo[assetID],
      payFlags: { totalFee: 2000 }
    },
    // Nominal price * amount paid to buyer
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: buybackLsig.address(),
      lsig: buybackLsig,
      toAccountAddr: buyerAccount.addr,
      amountMicroAlgos: exitAmount,
      payFlags: { totalFee: 0 }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount,
      appID: appInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:exit']
    }
  ];

  console.log('Exiting');
  await executeTransaction(deployer, exitTx);
  console.log('Exited');
}

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const creatorAccount = deployer.accountsByName.get('john');
  const managerAcc = deployer.accountsByName.get('alice');
  const buyerAccount = deployer.accountsByName.get('bob');

  // Create DEX, burn B_0, issue B_1
  await createDex(deployer, masterAccount, creatorAccount, managerAcc);

  // Redeem coupon_value
  await redeem(deployer, buyerAccount, managerAcc);

  // create buyback
  await createBuyback(deployer, managerAcc);

  // exit buyer from bond, buyer can exit only if maturity period is over
  // currently set to 1000 seconds
  await exitBuyer(deployer, buyerAccount);
}

module.exports = { default: run };
