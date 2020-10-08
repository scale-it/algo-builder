const {
  transferASAContract
} = require('../../src/asa-helpers');

async function run(runtimeEnv, deployer) {

  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");

  const lsig = await deployer.getLogicSignature("gold_asa.teal", []);
  lsig.sign(goldOwnerAccount.sk);
  const assetID =  deployer.asa.get("gold").assetIndex;
  // Will pass - As according to .teal logic, amount should be <= 1000
  // Transaction PASS
  await transferASAContract(deployer, goldOwnerAccount, johnAccount, 500, assetID, lsig);

  // Gets rejected by logic - As according to .teal logic, amount should be <= 100
  // Transaction FAIL
  try {
    await transferASAContract(deployer, goldOwnerAccount, johnAccount, 1500, assetID, lsig);
  } catch (e) {
    console.log('Transaction Failed -', e);
  }

}

module.exports = { default: run }
