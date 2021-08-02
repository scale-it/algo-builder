const {
  executeTransaction, convert, readGlobalStateSSC, balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { accounts } = require('./common/accounts.js');
const { fundAccount } = require('./common/common.js');
const { createDex } = require('./createDex.js');
const { epoch0 } = require('./epoch0.js');
const { issue } = require('./issue.js');

let newAsaInfo;
let appInfo;
let asaInfo;
let buybackLsig;
const assetID = 'asset-index';

async function run (runtimeEnv, deployer) {
  // fund buyers and creator, app manager
  const account = await accounts(deployer);
  /* await fundAccount (deployer, account.bob.addr);
  await fundAccount (deployer, account.elon.addr);
  await fundAccount (deployer, account.manager.addr);
  await fundAccount (deployer, account.creator.addr);

  // epoch0 -> createDex -> epoch1 -> createDex -> redeem -> createBuyback -> exit

  await issue(deployer);

  await epoch0(deployer); */

  // Create DEX, burn B_0, issue B_1
  await createDex(deployer, account.creator, account.manager, 1);

  // Redeem coupon_value
  // await redeem(deployer, buyerAccount, managerAcc);

  // create buyback
  // await createBuyback(deployer, managerAcc);

  // exit buyer from bond, buyer can exit only if maturity period is over
  // currently set to 1000 seconds
  // await exitBuyer(deployer, buyerAccount);
}

module.exports = { default: run };
