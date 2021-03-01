const { executeTransaction } = require('@algorand-builder/algob');
const { mkParam } = require('./transfer/common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const goldOwner = deployer.accountsByName.get('alice');

  await executeTransaction(deployer, mkParam(masterAccount, goldOwner.addr, 200e6, { note: 'funding account' }));

  await deployer.fundLsig('2-gold-contract-asc.teal',
    { funder: goldOwner, fundingMicroAlgo: 1e6 }, {}, []); // funding with 1 Algo

  const ascInfoAlgoDelegated = await deployer.mkDelegatedLsig('3-gold-delegated-asc.teal',
    goldOwner, []);
  const ascInfoGoldDelegated = await deployer.mkDelegatedLsig('4-gold-asa.teal',
    goldOwner, []);

  console.log(ascInfoAlgoDelegated);
  console.log(ascInfoGoldDelegated);
}

module.exports = { default: run };
