const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { executeTransaction, fundAccount, totalSupply } = require('../common/common');

/**
 * NOTE: this function is for demonstration purpose only.
 * If asset creator is a multisig address, then user should have a signed tx file, decoded tx fetched
 * from that file, append his own signature & send it to network.
 *  - Use `algob.executeSignedTxnFromFile` to execute tx from file
 *  - In the function below we assume creator & reserve is a single account (alice)
 */
async function issue (deployer, address, amount) {
  const asaReserve = deployer.accountsByName.get('alice'); // asset reserve is the issuer

  const gold = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');

  const escrowParams = {
    TOKEN_ID: gold.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback.py', escrowParams);
  const escrowAddress = escrowLsig.address();

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
      foreignAssets: [gold.assetIndex]
    },
    /**
     * tx 1 - Asset transfer transaction from Token Reserve -> address. This tx is executed
     * and approved by the clawback escrow (since the asset is default frozen only clawback can move funds).
     * This tx doesn't need rule checks (as this is an issuance txn)
     */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: escrowAddress,
      recipient: address,
      assetID: gold.assetIndex,
      revocationTarget: asaReserve.addr, // tx will fail if assetSender is not token reserve address
      amount: amount,
      lsig: escrowLsig,
      payFlags: { totalFee: 1000 }
    }
  ];
  console.log(`* Issuing ${amount} tokens to [${address}] *`);
  await executeTransaction(deployer, issuanceParams);

  console.log(`* ${address} asset holding: *`);
  await balanceOf(deployer, address, gold.assetIndex); // print asset holding

  const supply = await totalSupply(deployer, gold.assetIndex);
  console.log(`Total Supply of token 'gold': ${supply}`);
}

async function run (runtimeEnv, deployer) {
  const elon = deployer.accountsByName.get('elon-musk');
  await fundAccount(deployer, elon); // fund elon

  // opt-in asa to account first (skip if opted-in already)
  console.log(`* Opt-In ASA gold for ${elon.name} *`);
  await deployer.optInAcountToASA('gold', elon.name, {});
  console.log('* Opt-In Successful *');

  /**
   * If using msig address as asa token reserve, then realistically user will receive a tx
   * file signed by accounts <= threshold in a multisig group.
   * - After receiving file, place it in /assets
   * - Use `algob sign-multisig <account>` to append signature of your account
   * - Then use the function below to issue new tokens and send tx to a network
   */
  // executeSignedTxnFromFile(deployer, 'asa_file_out.tx');

  // use below function to whitelist elon
  // await whitelist(deployer, alice, elon.addr);

  /**
   * - just for tutorial purpose. Below function issues new token from reserve account (which is a single
   *   account - alice).
   * - Note: We don't need to add rules check for issuer, as the issuer creates the rules itself
   */
  await issue(deployer, elon.addr, 15); // issue(mint) 15 tokens to elon from reserve
}

module.exports = { default: run, issue: issue };
