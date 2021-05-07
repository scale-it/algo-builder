const { types } = require('@algo-builder/runtime');
const { issue } = require('./issue');
const { executeTransaction, fundAccount } = require('../common/common');

/**
* NOTE: this function is for demonstration purpose only (if ASA manager is a single account)
* If asset manager is a multisig address, then user should have a signed tx file, decoded tx fetched
* from that file, append his own signature & send it to network.
*  - Use `algob.executeSignedTxnFromFile` to execute tx from file
*  - Use below function of asa.manager is single account
*/
async function kill (deployer) {
  // alice is set as asset manager during deploy
  const asaManager = deployer.accountsByName.get('alice');
  await fundAccount(deployer, asaManager);

  /**
   * tx - Call to controller stateful smart contract with application arg: 'kill'
   * Only token manager can kill a token. If token is killed then all token transfers
   * (eg. issue, transfer(a, b)) are rejected. Token holder can only do opt-out txn after
   * token is killed.
   */
  const gold = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');
  const killParams = {
    type: types.TransactionType.CallNoOpSSC,
    sign: types.SignType.SecretKey,
    fromAccount: asaManager,
    appId: controllerSSCInfo.appID,
    payFlags: { totalFee: 1000 },
    appArgs: ['str:kill'],
    foreignAssets: [gold.assetIndex]
  };

  console.log('* Kill Token: Gold *');
  await executeTransaction(deployer, killParams);
}

async function run (runtimeEnv, deployer) {
  const elon = deployer.accountsByName.get('elon-musk');
  await fundAccount(deployer, elon); // fund elon

  /**
   * If using msig address as the token manager, then realistically user will receive a tx
   * file signed by accounts <= threshold in a multisig group.
   * - After receiving file, place it in /assets
   * - Use `algob sign-multisig <account>` to append signature of your account
   * - Then use below function to issue new tokens (send tx to network)
   */
  // executeSignedTxnFromFile(deployer, 'asa_kill_out.tx');

  // transaction pass (issue 15 tokens to elon)
  await deployer.optInAcountToASA('gold', elon.name, {});
  await issue(deployer, elon.addr, 15);

  /**
   * Below function kills token gold (if asa.manager is a single account)
   */
  await kill(deployer); // kill token 'gold'

  // transaction FAIL: as token is killed
  await issue(deployer, elon.addr, 15);
}

module.exports = { default: run, kill: kill };
