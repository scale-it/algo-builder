const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { executeTransaction, fundAccount } = require('../common/common');

/**
 * NOTE: this function is for demonstration purpose only (if ASA creator, manager are single accounts)
 * If asset creator is a multisig address, then user should have a signed tx file, decoded tx fetched
 * from that file, append his own signature & send it to network.
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from file
 *  - In below function we assume creator & reserve is a single account (alice)
 */
async function issue (deployer, account, amount) {
  const alice = deployer.accountsByName.get('alice');

  // TODO: use deployer.loadASA() to retreive asset reserve
  const asaReserve = alice; // asset reserve is the issuer
  const asaInfo = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');

  const escrowParams = {
    TOKEN_ID: asaInfo.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback-escrow.py', [], escrowParams);
  const escrowAddress = escrowLsig.address();

  // opt-in asa to account first (skip if opted-in already)
  console.log(`* Opt-In ASA gold for ${account.name} *`);
  await deployer.optInAcountToASA('gold', account.name, {});
  console.log('* Opt-In Successful *');

  const issuanceParams = [
    /**
     * tx 0 - Call to controller stateful smart contract with application arg: 'issue'
     * The 'issue' branch ensures that sender is the token reserve and token is not killed
     * Issuance tx will be rejected if token has been killed by the manager
     */
    {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: asaReserve,
      appId: controllerSSCInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:issue'],
      foreignAssets: [asaInfo.assetIndex]
    },
    /**
     * tx 1 - Asset transfer transaction from Token Reserve -> account. This tx is executed
     * and approved by the clawback escrow (since the asset is default frozen only clawback can move funds).
     * This tx doesn't need rule checks (as this is an issuance txn)
     */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccount: { addr: escrowAddress },
      recipient: account.addr,
      assetID: asaInfo.assetIndex,
      revocationTarget: asaReserve.addr, // tx will fail if assetSender is not token reserve address
      amount: amount,
      lsig: escrowLsig,
      payFlags: { totalFee: 1000 }
    }
  ];
  console.log(`* Issuing ${amount} tokens to ${account.name}:${account.addr} *`);
  await executeTransaction(deployer, issuanceParams);

  console.log(`* ${account.name} asset holding: *`);
  await balanceOf(deployer, account.addr, asaInfo.assetIndex); // print asset holding
}

async function run (runtimeEnv, deployer) {
  const elon = deployer.accountsByName.get('elon-musk');
  await fundAccount(deployer, elon); // fund elon

  /**
   * If using msig address as asa token reserve, then realistically user will receive a tx
   * file signed by accounts <= threshold in a multisig group.
   * - After receiving file, place it in /assets
   * - Use `algob sign-multisig <account>` to append signature of your account
   * - Then use below function to issue new tokens (send tx to network)
   */
  // executeSignedTxnFromFile(deployer, 'asa_file_out.tx');

  // use below function to whitelist elon first (which opts in as well)
  // await whitelist(elon, deployer);

  /**
   * - just for tutorial purpose. Below function issues new token from reserve account (which is a single
   *   account - alice).
   * - Note: We don't need to add rules check for issuer, as the issuer creates the rules itself
   */
  await issue(deployer, elon, 15); // issue(mint) 15 tokens to elon from reserve
}

module.exports = { default: run, issue: issue };
