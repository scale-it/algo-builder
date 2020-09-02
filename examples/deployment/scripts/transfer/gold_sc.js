const {
  transferMicroAlgosContract
} = require('../src/asa-helpers');

async function run(runtimeEnv, accounts, deployer) {

  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");

  const logicSignature = deployer.asc.get("3-gold-asc.teal").logicSignature;

  // ALGO transfer

  // Will pass - As according to .teal logic, amount should be <= 100
  // Transaction PASS
  await transferMicroAlgosContract(deployer, goldOwnerAccount, johnAccount, 50, logicSignature);

  // Gets rejected by logic - As according to .teal logic, amount should be <= 100
  // Transaction FAIL
  try {
    await transferMicroAlgosContract(deployer, goldOwnerAccount, johnAccount, 150, logicSignature);
  } catch (e) {
    console.log('Transaction Failed -', e);
  }

}

module.exports = { default: run }
