/**
 * Description:
 * This file demonstrates the example to transfer contract owned ASA
 * from a contract account (lsig) to an owner account.
 * The logic assures that:
 *  + tx is asset transfer and amount is <= 100 and receiver is `alice`
 *  + fee is <= 1000
 *  + we don't do any rekey, closeRemainderTo
*/
const { types } = require('@algo-builder/runtime');
const { balanceOf } = require('@algo-builder/algob');
const { executeTransaction, mkParam } = require('./common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const alice = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  await executeTransaction(deployer, mkParam(masterAccount, alice.addr, 5e6, { note: 'Funding' }));

  // Get AppInfo and AssetID from checkpoints.
  const appInfo = deployer.getSSC('5-contract-asa-stateful.py', '5-clear.py');
  const lsig = await deployer.loadLogic('5-contract-asa-stateless.py', [], { APP_ID: appInfo.appID });

  /* Transfer ASA 'gold' from contract account to user account */
  const assetID = deployer.asa.get('platinum').assetIndex;
  console.log('Asset Index: ', assetID);

  await deployer.optInAcountToASA('platinum', 'alice', {});

  const txGroup = [
    // Stateful call
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: alice,
      appId: appInfo.appID,
      payFlags: {}
    },
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      toAccountAddr: alice.addr,
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
    // tx FAIL: trying to receive asset from another account
    txGroup[0].fromAccount = bob;
    await executeTransaction(deployer, txGroup);
  } catch (e) {
    console.log(e);
  }

  try {
    // tx FAIL: trying to send asset directly without calling stateful smart contract
    await executeTransaction(deployer, {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: lsig.address(),
      toAccountAddr: alice.addr,
      amount: 20n,
      assetID: assetID,
      lsig: lsig,
      payFlags: { totalFee: 1000 }
    });
  } catch (e) {
    console.log(e);
  }
}

module.exports = { default: run };
