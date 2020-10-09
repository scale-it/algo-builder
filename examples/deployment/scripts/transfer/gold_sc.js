const {
  transferASAContract
} = require('../../src/asa-helpers');

async function run(runtimeEnv, deployer) {
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");

  const lsig = await deployer.getLogicSignature("4-gold-asa.teal", []);
  const lsigJohn = lsig;
  lsigJohn.sign(johnAccount.sk);
  const lsigGoldOwner = lsig;
  lsigGoldOwner.sign(goldOwnerAccount.sk);
  const assetID =  deployer.asa.get("gold").assetIndex;
  // Will pass - As according to .teal logic, amount should be <= 1000
  // Transaction PASS
  const details = await transferASAContract(deployer, goldOwnerAccount, johnAccount, 500, assetID, lsigGoldOwner);
  console.log(details);
  // Gets rejected by logic - As according to .teal logic, amount should be <= 1000
  // Transaction FAIL
  try {
    await transferASAContract(deployer, goldOwnerAccount, johnAccount, 1500, assetID, lsigGoldOwner);
  } catch (e) {
    console.log('Transaction Failed - rejected by logic');
    // Error
    //console.error(e);
  }
  // Transaction fail as John tried to send instead of GoldOwner
  try {
    await transferASAContract(deployer, johnAccount, bobAccount, 100, assetID, lsigJohn);
  } catch(e) {
    console.log('Transaction Failed - rejected by logic')
    // Error
    //console.error(e);
  }

}

module.exports = { default: run }
