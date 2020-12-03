const { executeTransaction, mkTxnParams } = require('./common/common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const john = deployer.accountsByName.get('john');
  const bob = deployer.accountsByName.get('bob');

  const scInitParam = {
    TMPL_TO: john.addr,
    TMPL_AMT: 700000,
    TMPL_CLS: masterAccount.addr,
    TMPL_FV: 10,
    TMPL_LV: 1000000,
    TMPL_LEASE: '023sdDE2'
  };
  const contractName = 'dynamic-fee.py';
  // setup a contract account and send 1 ALGO from master
  await deployer.fundLsig(contractName,
    { funder: masterAccount, fundingMicroAlgo: 100000000 },
    { closeRemainderTo: masterAccount.addr }, [], scInitParam);

  const contract = await deployer.loadLogic(contractName, [], scInitParam);
  const escrow = contract.address(); // contract account

  await deployer.mkDelegatedLsig(contractName, masterAccount, [], scInitParam); // sign contract
  const signedContract = await deployer.getDelegatedLsig(contractName);
  console.log('SIGn1 ', signedContract);

  let transactions = [
    mkTxnParams(masterAccount, escrow, 1000, signedContract, { totalFee: 1000 }),
    mkTxnParams({ addr: escrow }, john.addr, 700000, contract,
      { totalFee: 1000, closeRemainderTo: bob.addr })];

  // Group Transaction FAIL - Correct transaction Fee is used BUT closeRemainderTo is set to bob
  await executeTransaction(deployer, transactions);

  transactions = [
    mkTxnParams(masterAccount, escrow, 1000, signedContract, { totalFee: 1000 }),
    mkTxnParams({ addr: escrow }, john.addr, 700000, contract,
      { totalFee: 1000, closeRemainderTo: masterAccount.addr })];

  // Group Transaction PASS - Correct transaction Fee is used and closeRemainderTo is set to master
  await executeTransaction(deployer, transactions);
}

module.exports = { default: run };
