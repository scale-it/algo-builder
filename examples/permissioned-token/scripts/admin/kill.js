const { types } = require('@algo-builder/web');
const { issue } = require('./issue');
const { executeTransaction, fundAccount } = require('../common/common');
const accounts = require('../common/accounts');

async function kill (deployer) {
  const owner = deployer.accountsByName.get(accounts.owner);
  await fundAccount(deployer, owner);

  /*
   * tx - Call to controller stateful smart contract with application arg: 'kill'
   * Only token manager can kill a token. If token is killed then all token transfers
   * (eg. issue, transfer(a, b)) are rejected. Token holder can only do opt-out txn after
   * token is killed.
   */
  const tesla = deployer.asa.get('tesla');
  const controllerAppInfo = deployer.getApp('controller.py', 'clear_state_program.py');
  const killParams = {
    type: types.TransactionType.CallApp,
    sign: types.SignType.SecretKey,
    fromAccount: owner,
    appID: controllerAppInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:kill'],
    foreignAssets: [tesla.assetIndex]
  };

  console.log('* Kill Token: tesla *');
  await executeTransaction(deployer, killParams);
}

async function run (runtimeEnv, deployer) {
  const elon = deployer.accountsByName.get('elon-musk');
  await fundAccount(deployer, elon); // fund elon

  // transaction pass (issue 15 tokens to elon)
  await deployer.optInAccountToASA('tesla', elon.name, {});
  await issue(deployer, elon.addr, 15);

  await kill(deployer); // kill token 'tesla'

  // transaction FAIL: token is killed, we can't issue tokens
  await issue(deployer, elon.addr, 15);
}

module.exports = { default: run, kill: kill };
