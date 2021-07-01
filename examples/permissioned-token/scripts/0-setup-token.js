const { fundAccount, totalSupply } = require('./common/common');
const accounts = require('./common/accounts');

/**
 * NOTE: this function is for demonstration purpose only
 * Below, we use a single account creator.
 * If asset creator is a multisig address, then user should use a signed tx file, decoded tx
 * from that file, append his own signature & send it to network.
 *  - Use `algob.signMultiSig` or cli command `algob sign-multisig` to
 *  add the signature to multi-sig transaction file
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from a signed file
 */
async function setupASA (runtimeEnv, deployer) {
  const owner = deployer.accountsByName.get(accounts.owner);

  // Fund account with ALGO to provide enough balance to create the Tesla shares
  await fundAccount(deployer, owner);
  const tesla = await deployer.deployASA('tesla', { creator: owner });

  console.log(tesla);
  console.log('total Supply: ', await totalSupply(deployer, tesla.assetIndex));

  /*
   * If using msig address as asa creator or manager, then realistically user will receive a signed tx
   * file from accounts <= threshold in a multisig group.
   * - After receiving file, place it in /assets
   * - Use `algob sign-multisig <account> filename` to append signature of your account
   * - Then use below function to deploy asset (send tx to network + wait for confirmation)
   */
  // executeSignedTxnFromFile(deployer, 'asa_file_out.tx');
}

module.exports = { default: setupASA };
