const { transferMicroAlgosLsig, transferASALsig } = require("algob");

async function run(runtimeEnv, deployer) {
  const goldOwnerAccount = deployer.accountsByName.get("gold-owner-account");
  const johnAccount = deployer.accountsByName.get("john-account");
  const bobAccount = deployer.accountsByName.get("bob-account");

  // Transactions for GOLD ASA contract : '4-gold-asa.teal'
  const lsig = await deployer.getLogicSignature("4-gold-asa.teal", []);
  const lsigJohn = lsig;
  lsigJohn.sign(johnAccount.sk);
  const lsigGoldOwner = lsig;
  lsigGoldOwner.sign(goldOwnerAccount.sk);
  const assetID =  deployer.asa.get("gold").assetIndex;
  // Will pass - As according to .teal logic, amount should be <= 1000
  // Transaction PASS
  const details = await transferASALsig(deployer, goldOwnerAccount, johnAccount.addr, 500, assetID, lsigGoldOwner);
  console.log(details);
  // Gets rejected by logic - As according to .teal logic, amount should be <= 1000
  // Transaction FAIL
  try {
    await transferASALsig(deployer, goldOwnerAccount, johnAccount.addr, 1500, assetID, lsigGoldOwner);
  } catch (e) {
    console.log('Transaction Failed - rejected by logic');
    // Error
    //console.error(e);
  }
  // Transaction fail as John tried to send instead of GoldOwner
  try {
    await transferASALsig(deployer, johnAccount, bobAccount.addr, 100, assetID, lsigJohn);
  } catch(e) {
    console.log('Transaction Failed - rejected by logic')
    // Error
    //console.error(e);
  }

  // Transaction for ALGO - Contract : '3-gold-asc.teal'
  const logicSignature = await deployer.getLogicSignature("3-gold-asc.teal", []);
  logicSignature.sign(goldOwnerAccount.sk);
  // Will pass - As according to .teal logic, amount should be <= 100
  // Transaction PASS
  const tranDetails =  await transferMicroAlgosLsig(deployer, goldOwnerAccount, bobAccount.addr, 58, logicSignature);
  console.log(tranDetails);

  // Gets rejected by logic - As according to .teal logic, amount should be <= 100
  // Transaction FAIL
  try {
    await transferMicroAlgosLsig(deployer, goldOwnerAccount, bobAccount.addr, 580, console.logicSignature);
  } catch(e) {
    console.log('Transaction Failed - rejected by logic')
    // Error
    //console.error(e);
  }
  
}

module.exports = { default: run }
