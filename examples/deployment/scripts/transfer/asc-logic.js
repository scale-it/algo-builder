const {
  transferMicroAlgosContract
} = require('../src/asa-helpers');

async function run(runtimeEnv, accounts, deployer) {

  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");

  if (deployer.isDeployMode) {

    const logicSignature = deployer.asc.get("3-gold-asc.teal").logicSignature;

    // WIll pass
    await transferMicroAlgosContract(deployer, goldOwnerAccount, johnAccount, 99, logicSignature);

    // Gets rejected by logic
    await transferMicroAlgosContract(deployer, goldOwnerAccount, johnAccount, 101, logicSignature);

  }
}

module.exports = { default: run }
