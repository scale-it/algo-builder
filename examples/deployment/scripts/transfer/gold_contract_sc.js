const { transferMicroAlgosLsig } = require("algob");

async function run(runtimeEnv, deployer) {
  const johnAccount = deployer.accountsByName.get("john-account");
  const elonMuskAccount = deployer.accountsByName.get("elon-musk-account");

  // Transactions for Transaction for ALGO - Contract : '2-gold-contract-asc.teal'  (Contract Approval Mode)
  const lsig = await deployer.getLogicSignature("2-gold-contract-asc.teal", []);
  
  const sender = lsig.address(); // sender is contract account

  // Will pass - As according to .teal logic, amount should be >= 100 and receiver should be john
  const details = await transferMicroAlgosLsig(deployer, sender, johnAccount.addr, 200, lsig);
  console.log(details);
  
  // Gets rejected by logic - As according to .teal logic, amount should be >= 100
  try {
    await transferMicroAlgosLsig(deployer, sender, johnAccount.addr, 20, lsig);
  } catch (e) {
    console.log('Transaction Failed - rejected by logic');
    //console.error(e);
  }

  // Transaction fail as Elon tried to receive instead of John
  try {
    await transferMicroAlgosLsig(deployer, sender, elonMuskAccount.addr, 500, lsig);
  } catch(e) {
    console.log('Transaction Failed - rejected by logic');
    //console.error(e);
  }
  
}

module.exports = { default: run }
