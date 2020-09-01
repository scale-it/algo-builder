const {
  printAssetHolding,
  transferAsset,
  asaOptIn,
  asaOptInContract,
  transferMicroAlgosContract
} = require('../src/asa-helpers');

async function run(runtimeEnv, accounts, deployer) {

  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");

  if (deployer.isDeployMode) {

    const ascInfo = await deployer.deployASC("3-gold-asc.teal", [], {
     funder: goldOwnerAccount, fundingMicroAlgo: 1000000 }, {})
    console.log(ascInfo);

  }
}

module.exports = { default: run }
