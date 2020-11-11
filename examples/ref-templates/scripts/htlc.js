const { transferMicroAlgos, transferMicroAlgosLsig } = require("algob");

async function transferAlgo(deployer, senderAddr, receiverAddr, amount, lsig, payFlags){
    try {
        const details = await transferMicroAlgosLsig(deployer, senderAddr, receiverAddr, amount, lsig, payFlags);
        console.log(details);
    } catch (e) {
        console.error('Transaction Failed', e);
    }
}

async function run(runtimeEnv, deployer) {

  const masterAccount = deployer.accountsByName.get("master-account")
  const johnAccount = deployer.accountsByName.get("john-account");
  const globalZeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

  await transferMicroAlgos(deployer, masterAccount, johnAccount.addr, 200000000, {note: "funding account"});  

  const secret = "hero wisdom green split loop element vote belt";
  const wrongSecret = "hero wisdom red split loop element vote belt";

  // setup a contract account and send 1 ALGO from master
  await deployer.fundLsig("htlc.py", [], { funder: masterAccount, fundingMicroAlgo: 1000000 }, { closeRemainderTo: johnAccount.addr }); 

  let contract = await deployer.loadLogic("htlc.py", [ wrongSecret ]);
  let contractAddress = contract.address();
  
  // Fails as wrong secret is passed
  await transferAlgo(deployer, { addr: contractAddress}, globalZeroAddress, 0, contract, { totalFee: 1000, closeRemainderTo: johnAccount.addr});

  contract = await deployer.loadLogic("htlc.py", [ secret ]);
  contractAddress = contract.address();

  // Passes as right secret is passed
  await transferAlgo(deployer, { addr: contractAddress}, globalZeroAddress, 0, contract, { totalFee: 2000, closeRemainderTo: johnAccount.addr});
  
}

module.exports = { default: run }