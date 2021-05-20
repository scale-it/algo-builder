/**
 * In this script we will fund an escrow contract. The escrow contract
 * ensures the payment is made out(from the escrow) to a specific receiver only.
 * This receiver address is hardcoded in the smart contract, and can be passed
 * dynamically to the contract using fundLsig function (passed as a template parameter)
 */
async function run (runtimeEnv, deployer) {
  console.log('Sample script for escrow account started execution!');

  // RECEIVER_ADDRESS is set in escrow.py when it is compiled from PyTEAL to TEAL
  const templateParams = {
    RECEIVER_ADDRESS: 'WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY'
  };
  await deployer.fundLsig('escrow.py',
    { funder: deployer.accounts[0], fundingMicroAlgo: 20e6 }, {fee: 1000}, templateParams);

  await deployer.addCheckpointKV('User Checkpoint Escrow', 'Fund Escrow Account');
  console.log('Sample script for escrow account has finished execution!');
}

module.exports = { default: run };
