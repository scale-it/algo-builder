/**
 * Description:
 * This file demonstrates how to create ASA owned by
 * smart contract account(stateless).
 * Steps:
 * - Deploy SSC (controls asa)
 * - Create contract account (with ssc app_id embedded/passed as a template param)
 * - Deploy ASA using both contracts
 */
const { executeTransaction } = require('@algo-builder/algob');
const { mkParam } = require('./transfer/common');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const alice = deployer.accountsByName.get('alice');

  await executeTransaction(deployer, mkParam(masterAccount, alice.addr, 200e6, { note: 'funding account' }));

  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  const sscInfo = await deployer.deploySSC(
    '5-contract-asa-stateful.py', // approval program
    '5-clear.py', // clear program
    {
      sender: alice,
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1
    }, {});

  console.log(sscInfo);

  // Get Statless Account Address
  const statelessAccount = await deployer.loadLogic('5-contract-asa-stateless.py', { APP_ID: sscInfo.appID });
  console.log('stateless Account Address:', statelessAccount.address());

  await executeTransaction(deployer, mkParam(masterAccount, statelessAccount.address(), 200e6, { note: 'funding account' }));

  const txGroup = [
    // Stateful call
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice,
      appId: sscInfo.appID,
      payFlags: {}
    },
    // Asset creation
    {
      type: types.TransactionType.DeployASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: statelessAccount.address(),
      asaName: 'platinum',
      lsig: statelessAccount,
      payFlags: {}
    },
    // Payment of 1 algo signed by alice
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: alice,
      toAccountAddr: statelessAccount.address(),
      amountMicroAlgos: 1e6,
      payFlags: {}
    }
  ];

  await executeTransaction(deployer, txGroup);

  // This should fail because maximum number of asa creation limit is set to 1
  try {
    txGroup[1].asaName = 'alu';
    await executeTransaction(deployer, txGroup);
  } catch (e) {
    console.log(e.response?.error);
  }
}

module.exports = { default: run };
