const { executeTransaction } = require('algob');
const { mkParam } = require('./common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const john = deployer.accountsByName.get('john');

  await executeTransaction(deployer, mkParam(masterAccount, john.addr, 1000000, { note: 'ALGO PAID' }));
}

module.exports = { default: run };
