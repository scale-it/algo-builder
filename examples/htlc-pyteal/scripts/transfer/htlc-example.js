/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
 * In this scheme, the buyer funds a TEAL account with the sale price. 
 * The buyer also picks a secret value and encodes a secure hash of this value in 
 * the TEAL program. The TEAL program will transfer its balance to the seller 
 * if the seller is able to provide the secret value that corresponds to the hash in the program. 
*/
const { TransactionType, SignType, toBytes } = require("algob");
const { executeTransaction } = require("./common")

async function run(runtimeEnv, deployer) {

    const john = deployer.accountsByName.get("john"); // Seller
    const bob = deployer.accountsByName.get("bob"); // Buyer

    const secret = "hero wisdom green split loop element vote belt";
    const wrongSecret = "hero wisdom red split loop element vote belt";

    let lsig = await deployer.loadLogic("htlc.py", [ toBytes(wrongSecret) ]);
    let sender = lsig.address(); 
    
    let txnParams = {
        type: TransactionType.TransferAlgo,
        sign: SignType.LogicSignature,
        fromAccount: { addr: sender},
        toAccountAddr: john.addr,
        amountMicroAlgos: 200,
        lsig: lsig,
        payFlags: {totalFee: 1000}
    }
    // Transaction Fails : as wrong secret value is used
    await executeTransaction(deployer, txnParams);

    lsig = await deployer.loadLogic("htlc.py", [ toBytes(secret) ]);
    sender = lsig.address();

    // Transaction Passes : as right secret value is used
    txnParams.fromAccount = { addr: sender};
    txnParams.lsig = lsig;
    await executeTransaction(deployer, txnParams);

} 

module.exports = { default: run }
