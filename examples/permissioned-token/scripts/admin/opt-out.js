const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { issue } = require('./issue');
const { executeTransaction, fundAccount } = require('../common/common');

/**
 * To opt-out of the token, do an asset transfer transaction with
 * closeRemainderTo == token creator address (creator == reserve in this case)
 * @param {*} deployer algobDeployer
 * @param {*} account account to opt-out of the token from
 */
async function optOut (deployer, account) {
  const gold = deployer.asa.get('gold');

  /**
   * NOTE: User can only optOut asset to asset-creator account. If reserve account
   * is different than creator, then creator will need to send these assets
   * to reserve account (after user has opted out).
   */
  const optOutParams = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: account,
    toAccountAddr: account.addr,
    assetID: gold.assetIndex,
    amount: 0,
    payFlags: { totalFee: 1000, closeRemainderTo: gold.creator }
  };

  console.log(`* Opting out [${account.name}:${account.addr}] from token 'gold' *`);
  await executeTransaction(deployer, optOutParams);
}

async function run (runtimeEnv, deployer) {
  const elon = deployer.accountsByName.get('elon-musk');
  const gold = deployer.asa.get('gold');

  // fund elon
  await fundAccount(deployer, elon);

  // opt in elon to gold first
  await deployer.optInAcountToASA('gold', elon.name, {});

  // first issue few tokens to elon
  await issue(deployer, elon.addr, 15); // issue(mint) 15 tokens to elon from reserve

  /**
   * Use below function to opt-out elon from token gold
   */
  await optOut(deployer, elon);

  await balanceOf(deployer, elon.addr, gold.assetIndex); // prints nothing
}

module.exports = { default: run, optOut: optOut };
