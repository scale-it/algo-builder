const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

const issuePrice = 1000;
const couponValue = 20;
const nominalPrice = 1000;

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

const tokenMap = new Map();

/**
 * returns asset id for a given asset name
 * @param name asset name
 */
async function getAssetID (name, deployer) {
  const asaInfo = await deployer.getASAInfo(name);
  return asaInfo.assetIndex;
}

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

// Opt-In lsigs to a given asa
async function optInTx (deployer, managerAcc, lsig, assetIndex) {
  const optInTx = [
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: managerAcc,
      toAccountAddr: lsig.address(),
      amountMicroAlgos: 0,
      payFlags: {}
    },
    {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      lsig: lsig,
      assetID: assetIndex,
      payFlags: {}
    }
  ];
  await executeTransaction(deployer, optInTx);
}

/**
 * Returns group transaction for buy
 * @param buyer buyer account
 * @param issuerLsig issuer logic signature
 * @param amount amount of bonds
 * @param algoAmount amount of algo
 * @param appID application index
 * @param bondID bond index
 */
function buyTx (buyer, issuerLsig, amount, algoAmount, appID, bondID) {
  return [
    // Algo transfer from buyer to issuer
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: buyer,
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
      toAccountAddr: buyer.addr,
      amount: amount,
      assetID: bondID,
      payFlags: { totalFee: 0 }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: buyer,
      appID: appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:buy']
    }
  ];
}

/**
 * Returns issue group transaction
 * @param creatorAccount creator acccount
 * @param issuerLsig issuer logic signature
 * @param appID application index
 * @param bondID bond index
 */
function issueTx (creatorAccount, issuerLsig, appID, bondID) {
  return [
    // Bond asa transfer to issuer's address
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      toAccountAddr: issuerLsig.address(),
      amount: 1e6,
      assetID: bondID,
      payFlags: { }
    },
    // call to bond-dapp
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: creatorAccount,
      appID: appID,
      payFlags: {},
      appArgs: ['str:issue']
    }
  ];
}

module.exports = {
  issuePrice,
  asaDef,
  fundAccount,
  getAssetID,
  tokenMap,
  couponValue,
  optInTx,
  nominalPrice,
  buyTx,
  issueTx
};
