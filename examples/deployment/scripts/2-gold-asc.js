const {
  printAssetHolding,
  transferAsset,
  asaOptIn,
  asaOptInContract,
  transferMicroAlgosContract
} = require('../src/asa-helpers');

async function run(runtimeEnv, deployer) {

  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");

  const ascInfo = await deployer.deployASC("3-gold-asc.teal", [],
  {funder: goldOwnerAccount, fundingMicroAlgo: 1000000 }, {});

  console.log(ascInfo);
}

module.exports = { default: run }
