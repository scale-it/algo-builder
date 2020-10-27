/**
 * Description:
 * This file demonstrates the PyTeal Example for HLTC(Hash Time Lock Contract)
 * In this scheme, the buyer funds a TEAL account with the sale price. 
 * The buyer also picks a secret value and encodes a secure hash of this value in 
 * the TEAL program. The TEAL program will transfer its balance to the seller 
 * if the seller is able to provide the secret value that corresponds to the hash in the program. 
*/
const { transferAlgo } = require("./common");

async function run(runtimeEnv, deployer) {

    const johnAccount = deployer.accountsByName.get("john-account"); // Seller
    const bobAccount = deployer.accountsByName.get("bob-account"); // Buyer

    const secret = "hero wisdom green split loop element vote belt";
    const wrongSecret = "hero wisdom red split loop element vote belt";

    const lsig = await deployer.loadLsig("hltc.py", [ secret ]);
    const sender = lsig.address(); 
    
    // Transaction Passes : as right secret value is used
    await transferAlgo(deployer, { addr: sender}, johnAccount.addr, 200, lsig);

    const lsig1 = await deployer.loadLsig("hltc.py", [ wrongSecret ]);
    const sender1 = lsig1.address();

    // Transaction Fails : as wrong secret value is used
    await transferAlgo(deployer, { addr: sender1}, johnAccount.addr, 200, lsig1);

} 

module.exports = { default: run }
