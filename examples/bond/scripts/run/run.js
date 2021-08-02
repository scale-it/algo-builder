const {
  executeTransaction, convert, readGlobalStateSSC, balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { accounts } = require('./common/accounts.js');
const { fundAccount, getAssetID, tokenMap } = require('./common/common.js');
const { createDex } = require('./createDex.js');
const { epoch0 } = require('./epoch0.js');
const { epoch1 } = require('./epoch1.js');
const { issue } = require('./issue.js');
const { redeem } = require('./redeem.js');

async function run (runtimeEnv, deployer) {
  const oldBond = await getAssetID('bond-token-0', deployer);
  tokenMap.set('bond-token-0', oldBond);
  // tokenMap.set('bond-token-1', 24);
  // fund buyers and creator, app manager
  const account = await accounts(deployer);
  await fundAccount(deployer, account.bob.addr);
  await fundAccount(deployer, account.elon.addr);
  await fundAccount(deployer, account.manager.addr);
  await fundAccount(deployer, account.creator.addr);

  // epoch0 -> createDex -> epoch1 -> createDex -> redeem -> createBuyback -> exit

  await issue(deployer);

  await epoch0(deployer);
  // Create DEX, burn B_0, issue B_1
  await createDex(deployer, account.creator, account.manager, 1);

  await epoch1(deployer);

  // Create DEX, burn B_1, issue B_2
  await createDex(deployer, account.creator, account.manager, 2);

  // Redeem all 12 bonds from elon
  await redeem(deployer, account.elon, account.manager, 2, 12);

  // Redeem bob's bonds
  await redeem(deployer, account.bob, account.manager, 1, 2);
  await redeem(deployer, account.bob, account.manager, 2, 2);

  // create buyback
  // await createBuyback(deployer, managerAcc);

  // exit buyer from bond, buyer can exit only if maturity period is over
  // currently set to 1000 seconds
  // await exitBuyer(deployer, buyerAccount);
}

module.exports = { default: run };
