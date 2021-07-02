const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const accounts = require('./common/accounts');
const { getClawbackParams, getClawback } = require('./common/common');

/**
 * Compile and set clawback logic sig (escrow) with template parameters:
 * - token_id : deployed asa index
 * - controller_app_id: controller application index. This makes sure that
 *   rules smart contract is called in any token transfer b/w non-reserve accounts
 * - token_reserve: asa.reserve address (owner of all non-minted tokens). Clawback checks during
 *   Issuance tx that from account is the asset reserve
 */
async function setupClawback (runtimeEnv, deployer) {
  const owner = deployer.accountsByName.get(accounts.owner);

  // NOTE: make sure to deploy ASA and controller before
  const tesla = deployer.asa.get('tesla');
  const clawbackParams = getClawbackParams(deployer);
  const clawbackLsig = await getClawback(deployer);
  const clawbackAddress = clawbackLsig.address();

  /*
    Use code below if token_reserve is multisig account
    const bob = deployer.accountsByName.get('bob');
    const charlie = deployer.accountsByName.get('charlie');
    const john = deployer.accountsByName.get('john');
    // you can replace these addresses with your custom addrs for multisig account.
    const addrs = [alice.addr, bob.addr, john.addr, charlie.addr];
    const [_, multsigaddr] = createMsigAddress(1, 2, addrs); // use multsigaddr in TOKEN_RESERVE
  */

  await deployer.fundLsig('clawback.py',
    { funder: owner, fundingMicroAlgo: 5e6 }, {}, clawbackParams);

  console.log('\n** Updating asset clawback to lsig **');
  const assetConfigParams = {
    type: types.TransactionType.ModifyAsset,
    sign: types.SignType.SecretKey,
    fromAccount: owner,
    assetID: tesla.assetIndex,
    fields: { clawback: clawbackAddress },
    payFlags: { totalFee: 1000 }
  };
  await executeTransaction(deployer, assetConfigParams);
}

module.exports = { default: setupClawback };
