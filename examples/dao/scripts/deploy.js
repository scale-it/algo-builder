const {
  convert
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { fundAccount, executeTx } = require('./run/common/common.js');

const { accounts, getDepositLsig, getDAOFundLsig } = require('./run/common/accounts');
const { executeTransaction } = require('../../../packages/algob/build/lib/tx.js');

async function run (runtimeEnv, deployer) {
  const { creator, proposer, voterA, voterB } = accounts(deployer);

  // fund accounts
  await fundAccount(deployer, [creator, proposer, voterA, voterB]);

  // Create DAO Gov Token
  const asaInfo = await deployer.deployASA('gov-token', { creator: creator });
  console.log(asaInfo);

  // DAO App initialization parameters
  const deposit = 15; // deposit required to make a proposal
  const minSupport = 5; // minimum number of yes power votes to validate proposal
  const minDuration = 1 * 60; // 1min (minimum voting time in number of seconds)
  const maxDuration = 5 * 60; // 5min (maximum voting time in number of seconds)
  const url = 'www.my-url.com';

  const appArgs = [
    `int:${deposit}`,
    `int:${minSupport}`,
    `int:${minDuration}`,
    `int:${maxDuration}`,
    `str:${url}`
  ];
  const templateParam = { TMPL_GOV_TOKEN: asaInfo.assetIndex };
  // Create Application
  const daoAppInfo = await deployer.deployApp(
    'dao-app-approval.py',
    'dao-app-clear.py', {
      sender: creator,
      localInts: 9,
      localBytes: 7,
      globalInts: 4,
      globalBytes: 2,
      appArgs: appArgs
    }, {}, templateParam);
  console.log(daoAppInfo);

  // fund lsig's
  await Promise.all([
    deployer.fundLsig('deposit-lsig.py',
      { funder: creator, fundingMicroAlgo: 2e6 }, {},
      { TMPL_GOV_TOKEN: asaInfo.assetIndex, TMPL_DAO_APP_ID: daoAppInfo.appID }),

    deployer.fundLsig('dao-fund-lsig.py',
      { funder: creator, fundingMicroAlgo: 5e6 }, {},
      { TMPL_GOV_TOKEN: asaInfo.assetIndex, TMPL_DAO_APP_ID: daoAppInfo.appID }),

    deployer.fundLsig('proposal-lsig.py',
      { funder: creator, fundingMicroAlgo: 5e6 }, {})
  ]);

  console.log('* Adding vote_deposit_lsig to DAO *');
  const depositLsig = await getDepositLsig(deployer);
  const daoFundLsig = await getDAOFundLsig(deployer);
  const addAccountsTx = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: creator,
    appID: daoAppInfo.appID,
    payFlags: {},
    appArgs: [
      'str:add_deposit_accounts',
      `addr:${depositLsig.address()}`
    ]
  };
  await executeTx(deployer, addAccountsTx);

  console.log('* ASA distribution (Gov tokens) *');
  await Promise.all([
    deployer.optInLsigToASA(asaInfo.assetIndex, depositLsig, { totalFee: 1000 }),
    deployer.optInLsigToASA(asaInfo.assetIndex, daoFundLsig, { totalFee: 1000 }),
    deployer.optInAcountToASA(asaInfo.assetIndex, proposer.name, {}),
    deployer.optInAcountToASA(asaInfo.assetIndex, voterA.name, {}),
    deployer.optInAcountToASA(asaInfo.assetIndex, voterB.name, {})
  ]);

  const fundASAParams = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: creator,
    amount: 100,
    assetID: asaInfo.assetIndex,
    payFlags: { totalFee: 1000 }
  };
  await executeTransaction(deployer, [
    { ...fundASAParams, toAccountAddr: proposer.addr },
    { ...fundASAParams, toAccountAddr: voterA.addr },
    { ...fundASAParams, toAccountAddr: voterB.addr }
  ]);

  console.log('Contracts deployed successfully!');
}

module.exports = { default: run };
