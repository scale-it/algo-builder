/**
 * Description:
 * This file demonstrates how to change owner of ASA owned by
 * smart contract account(stateless).
 */
const { executeTransaction, convert } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { mkParam } = require('../common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const alice = deployer.accountsByName.get('alice');
  const bob = deployer.accountsByName.get('bob');

  await executeTransaction(deployer, mkParam(masterAccount, alice.addr, 5e6, { note: 'Funding' }));

  // Get AppInfo from checkpoint.
  const appInfo = deployer.getSSC('5-contract-asa-stateful.py', '5-clear.py');

  // App argument to change_owner.
  const appArgs = [convert.stringToBytes('change_owner'), convert.addressToPk(bob.addr)];

  const tx = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: alice,
    appID: appInfo.appID,
    payFlags: {},
    appArgs: appArgs
  };

  await executeTransaction(deployer, tx);
}

module.exports = { default: run };
