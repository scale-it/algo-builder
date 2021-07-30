const {
  executeTransaction, convert, readGlobalStateSSC
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const managerAcc = deployer.accountsByName.get('alice');
  const creatorAccount = deployer.accountsByName.get('john');

  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: managerAcc.addr,
    amountMicroAlgos: 200e6,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);
  algoTxnParams.toAccountAddr = creatorAccount.addr;
  await executeTransaction(deployer, algoTxnParams);

  // Create B_0 - Bond Token
  const asaInfo = await deployer.deployASA('bond-token-1', { creator: creatorAccount });
  console.log(asaInfo);

  // Bond-Dapp initialization parameters
  const appManager = convert.addressToPk(managerAcc.addr);
  const issuePrice = 'int:1000';
  const nominalPrice = 'int:1000';
  const maturityDate = convert.uint64ToBigEndian(Math.round(new Date().getTime() / 1000) + 1000);
  const couponValue = 'int:20';
  const currentBond = convert.uint64ToBigEndian(asaInfo.assetIndex);
  const asset = await deployer.getAssetByID(asaInfo.assetIndex);
  const maxIssuance = convert.uint64ToBigEndian(asset.params.total);
  const creator = convert.addressToPk(creatorAccount.addr);

  let appArgs = [
    appManager,
    creator,
    issuePrice,
    nominalPrice,
    maturityDate,
    couponValue,
    currentBond,
    maxIssuance
  ];
  // Create Application
  const bondAppInfo = await deployer.deployApp(
    'bond-dapp-stateful.py',
    'bond-dapp-clear.py', {
      sender: managerAcc,
      localInts: 1,
      localBytes: 1,
      globalInts: 8,
      globalBytes: 15,
      appArgs: appArgs
    }, {});
  console.log(bondAppInfo);

  // Initialize issuer lsig with bond-app ID
  const scInitParam = {
    TMPL_APPLICATION_ID: bondAppInfo.appID,
    TMPL_OWNER: creatorAccount.addr,
    TMPL_APP_MANAGER: managerAcc.addr
  };
  const issuerLsig = await deployer.loadLogic('issuer-lsig.py', scInitParam);

  algoTxnParams.toAccountAddr = issuerLsig.address();
  await executeTransaction(deployer, algoTxnParams);

  // Only app manager can opt-in issueer lsig to ASA
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
      assetID: asaInfo.assetIndex,
      payFlags: {}
    }
  ];
  await executeTransaction(deployer, optInTx);

  // update issuer address in bond-dapp
  appArgs = [
    'str:update_issuer_address',
    convert.addressToPk(issuerLsig.address())
  ];

  const appCallParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: managerAcc,
    appID: bondAppInfo.appID,
    payFlags: {},
    appArgs: appArgs
  };
  await executeTransaction(deployer, appCallParams);

  console.log('Issuer address updated!');
}

module.exports = { default: run };
