const { fundAccount, totalSupply } = require('./common/common');

/**
 * NOTE: this function is for demonstration purpose only (if ASA creator, manager are single accounts)
 * If asset creator is a multisig address, then user should have a signed tx file, decoded tx fetched
 * from that file, append his own signature & send it to network.
 *  - Use `algob.signMultiSig` or cli command `sign-multisig` to
 *  add the signature to multi-sig transaction file
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from file
 *  - In below function we assume creator is a single account (alice)
 */
async function setupASA (deployer) {
  const alice = deployer.accountsByName.get('alice');

  /** Fund Creator account by master **/
  await fundAccount(deployer, alice);
  return await deployer.deployASA('gold', { creator: alice });
}

async function run (runtimeEnv, deployer) {
  // just for tutorial purpose (use `executeSignedTxnFromFile` if using multisig account)
  const gold = await setupASA(deployer);
  console.log(gold);
  console.log('total Supply: ', await totalSupply(deployer, gold.assetIndex));

  /**
   * If using msig address as asa creator or manager, then realistically user will receive a signed tx
   * file from accounts <= threshold in a multisig group.
   * - After receiving file, place it in /assets
   * - Use `algob sign-multisig <account> filename` to append signature of your account
   * - Then use below function to deploy asset (send tx to network + wait for confirmation)
   */
  // executeSignedTxnFromFile(deployer, 'asa_file_out.tx');
}

module.exports = { default: run };
