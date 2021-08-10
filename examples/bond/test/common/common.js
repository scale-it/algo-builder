const { getProgram } = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { assert } = require('chai');

const bondToken = 'bond-token-';
const asaDef = {
  total: 1000000,
  decimals: 0,
  defaultFrozen: false,
  unitName: 'BOND',
  url: 'url',
  metadataHash: '12312442142141241244444411111133',
  noteb64: 'noteb64',
  manager: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
  reserve: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE',
  freeze: 'WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE'
};

function optIn (runtime, lsig, assetID, appManager) {
  // Only store manager can allow opt-in to ASA for lsig
  const optInTx = [
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: appManager.account,
      toAccountAddr: lsig.address(),
      amountMicroAlgos: 0,
      payFlags: {}
    },
    {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      lsig: lsig,
      assetID: assetID,
      payFlags: {}
    }
  ];
  runtime.executeTx(optInTx);
};

const placeholderParam = {
  TMPL_NOMINAL_PRICE: 1000,
  TMPL_MATURITY_DATE: Math.round(new Date().getTime() / 1000) + 240
};
const approvalProgram = getProgram('bond-dapp-stateful.py', placeholderParam);
const clearProgram = getProgram('bond-dapp-clear.py');

const minBalance = 10e6; // 10 ALGO's
const initialBalance = 200e6;
const coupon = 20;
const issue = 1000;

/**
 * Creates DEX_i lsig, burn B_i tokens, issue B_i+1 tokens
 * @param runtime runtime object
 * @param creatorAccount
 * @param managerAcc
 * @param i create ith dex
 * @param master
 * @param issuerLsig
 * i must be >= 1
 */
function createDex (runtime, creatorAccount, managerAcc, i, master, issuerLsig) {
  if (i < 1) {
    throw new Error('i must be greater than equal to 1');
  }

  const previousToken = bondToken + String(i - 1);
  const oldBond = runtime.getAssetInfoFromName(previousToken).assetIndex;
  const appInfo = runtime.getAppInfoFromName(approvalProgram, clearProgram);
  const newBondToken = bondToken + String(i);
  const getGlobal = (key) => runtime.getGlobalState(appInfo.appID, key);

  // Create B_[i+1]
  const newBond = runtime.addASADef(
    newBondToken,
    asaDef,
    { creator: { ...creatorAccount.account, name: 'bond-token-creator' } }
  );

  optIn(runtime, issuerLsig, newBond, managerAcc);

  // Create dex
  const param = {
    TMPL_OLD_BOND: oldBond,
    TMPL_NEW_BOND: newBond,
    TMPL_APPLICATION_ID: appInfo.appID,
    TMPL_APP_MANAGER: managerAcc.address
  };
  const dexLsigProgram = getProgram('dex-lsig.py', param);
  const dexLsig = runtime.getLogicSig(dexLsigProgram, []);
  const dexLsigAddress = dexLsig.address();

  // fund dex with some minimum balance first
  const fundDexParam = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: master.account,
    toAccountAddr: dexLsigAddress,
    amountMicroAlgos: minBalance + 10000,
    payFlags: {}
  };
  runtime.executeTx(fundDexParam);

  optIn(runtime, dexLsig, oldBond, managerAcc);
  optIn(runtime, dexLsig, newBond, managerAcc);

  const total = getGlobal('total');
  const assetAmount = runtime.getAccount(issuerLsig.address()).getAssetHolding(oldBond)?.amount;
  const groupTx = [
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: managerAcc.account,
      appID: appInfo.appID,
      payFlags: {},
      appArgs: ['str:create_dex'],
      accounts: [issuerLsig.address(), dexLsig.address()]
    },
    // New bond token transfer to issuer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount.account,
      toAccountAddr: issuerLsig.address(),
      amount: assetAmount,
      assetID: newBond,
      payFlags: { totalFee: 1000 }
    },
    // burn tokens
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: issuerLsig.address(),
      lsig: issuerLsig,
      toAccountAddr: creatorAccount.address,
      amount: assetAmount,
      assetID: oldBond,
      payFlags: { totalFee: 1000 }
    },
    // Transfer app.total amount of new Bonds to dex lsig
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount.account,
      toAccountAddr: dexLsig.address(),
      amount: total,
      assetID: newBond,
      payFlags: { totalFee: 1000 }
    },
    // Algo transfer to dex address
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount.account,
      toAccountAddr: dexLsig.address(),
      amountMicroAlgos: Number(total) * Number(coupon),
      payFlags: { totalFee: 1000 }
    }
  ];
  runtime.executeTx(groupTx);

  const issuer = runtime.getAccount(issuerLsig.address());
  assert.equal(runtime.getAccount(dexLsig.address()).getAssetHolding(newBond)?.amount, BigInt(total));
  assert.equal(issuer.getAssetHolding(oldBond)?.amount, 0n);
  assert.equal(issuer.getAssetHolding(newBond)?.amount, BigInt(assetAmount));

  return dexLsig;
}

/**
 * Redeem old tokens, get coupon_value + new bond tokens
 * @param runtime runtime object
 * @param buyerAccount buyer account
 * @param managerAcc manager account
 * @param dex dex number from which you want to make a redemption
 * @param amount bond amount
 * For ex: 1 means your 0 bond-tokens will be redeemed from 1st Dex
 */
function redeem (runtime, buyerAccount, dex, amount, dexLsig) {
  const appInfo = runtime.getAppInfoFromName(approvalProgram, clearProgram);
  const oldBond = runtime.getAssetInfoFromName(bondToken + String(dex - 1)).assetIndex;
  const newBond = runtime.getAssetInfoFromName(bondToken + String(dex)).assetIndex;
  const initBond = buyerAccount.getAssetHolding(oldBond)?.amount;

  runtime.optIntoASA(newBond, buyerAccount.address, {});

  const balanceBeforeRedeem = buyerAccount.balance();
  const groupTx = [
    // Transfer tokens to dex lsig.
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount.account,
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
      toAccountAddr: buyerAccount.address,
      amount: amount,
      assetID: newBond,
      payFlags: { totalFee: 0 }
    },
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: dexLsig.address(),
      lsig: dexLsig,
      toAccountAddr: buyerAccount.address,
      amountMicroAlgos: Number(amount) * Number(coupon),
      payFlags: { totalFee: 0 }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: buyerAccount.account,
      appID: appInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:redeem_coupon']
    }
  ];

  runtime.executeTx(groupTx);

  buyerAccount = runtime.getAccount(buyerAccount.address);
  assert.equal(buyerAccount.getAssetHolding(oldBond)?.amount, BigInt(initBond) - BigInt(amount));
  assert.equal(buyerAccount.getAssetHolding(newBond)?.amount, BigInt(amount));
  assert.equal(
    balanceBeforeRedeem + BigInt(amount) * BigInt(coupon) - 4000n,
    buyerAccount.balance()
  );
}

module.exports = {
  optIn,
  createDex,
  approvalProgram,
  clearProgram,
  minBalance,
  initialBalance,
  coupon,
  issue,
  redeem
};
