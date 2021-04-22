const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { issue } = require('../issuance/issue');
const { executeTransaction } = require('../common/common');

/**
 * To opt-out of the token, do an asset transfer transaction with
 * closeRemainderTo == token creator address (creator == reserve in this case)
 * @param {*} deployer algobDeployer
 * @param {*} account account to opt-out of the token from
 */
async function optOut (deployer, account) {
  const alice = deployer.accountsByName.get('alice');

  // TODO: use deployer.loadASA() to retreive asset reserve
  const asaCreator = alice; // asset reserve is the issuer
  const asaInfo = deployer.asa.get('gold');

  /**
   * NOTE: User can only optOut asset to asset-creator account. If reserve account
   * is different than creator, then creator will need to send these assets
   * to reserve account (after user has opted out).
   */
  const optOutParams = {
    type: types.TransactionType.TransferAsset,
    sign: types.SignType.SecretKey,
    fromAccount: account,
    toAccountAddr: asaCreator.addr,
    assetID: asaInfo.assetIndex,
    amount: 0,
    payFlags: { totalFee: 1000, closeRemainderTo: asaCreator.addr }
  };

  console.log(`* Opting out [${account.name}:${account.addr}] from token 'gold' *`);
  await executeTransaction(deployer, optOutParams);
}

async function run (runtimeEnv, deployer) {
  const elon = deployer.accountsByName.get('elon-musk');
  const asaInfo = deployer.asa.get('gold');

  // first issue few tokens to elon
  await issue(deployer, elon, 15); // issue(mint) 15 tokens to elon from reserve

  /**
   * Use below function to opt-out elon from token gold
   */
  await optOut(deployer, elon);

  await balanceOf(deployer, elon.addr, asaInfo.assetIndex); // prints nothing
}

module.exports = { default: run, optOut: optOut };
