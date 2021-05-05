/**
 * Description:
 * This file demonstrates the example to transfer contract owned ASA
 * from a contract account (lsig) to an changed owner account.
 * Note: This transfer will only work if owner is changed to bob
*/
const { types } = require('@algo-builder/runtime');
const { balanceOf } = require('@algo-builder/algob');
const { executeTransaction, mkParam } = require('./common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const alice = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  await executeTransaction(deployer, mkParam(masterAccount, bob.addr, 5e6, { note: 'Funding' }));
  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC('5-contract-asa-stateful.py', '5-clear.py');
  const lsig = await deployer.loadLogic('5-contract-asa-stateless.py', [], { APP_ID: appInfo.appID });

  /* Transfer ASA 'gold' from contract account to user account */
  const assetID = deployer.asa.get('platinum').assetIndex;
  console.log('Asset Index: ', assetID);
  await deployer.optInAcountToASA('platinum', 'bob', {});

  const txGroup = [
    // Stateful call
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: bob,
      appId: appInfo.appID,
      payFlags: {}
    },
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      toAccountAddr: bob.addr,
      amount: 20n,
      assetID: assetID,
      lsig: lsig,
      payFlags: { totalFee: 1000 }
    }
  ];

  await executeTransaction(deployer, txGroup);
  // print assetHolding of alice
  await balanceOf(deployer, alice.addr, assetID);

  try {
    // tx FAIL: trying to receive asset from initial owner account
    txGroup[0].fromAccount = alice;
    await executeTransaction(deployer, txGroup);
  } catch (e) {
    console.log(e);
  }
}

module.exports = { default: run };
