const algosdk = require('algosdk');
const {
  printCreatedAsset,
  printAssetHolding,
  transferMicroAlgos,
  asaOptIn,
  transferAsset
} = require('../../src/asa-helpers');

async function run(runtimeEnv, accounts, deployer) {
  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account");

  await transferMicroAlgos(deployer, masterAccount, johnAccount.addr, 1000000)
}

module.exports = { default: run }
