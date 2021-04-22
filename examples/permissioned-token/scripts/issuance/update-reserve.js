const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { executeTransaction, fundAccount } = require('../common/common');

/**
* NOTE: this function is for demonstration purpose only (if ASA manager is a single account)
* If asset manager is a multisig address, then user will receive a signed tx file, decoded tx fetched
* from that file, append his own signature & send it to network.
*  - Use `algob.executeSignedTxnFromFile` to execute tx from file
*  - Use below function if asa.manager is single account
*/
async function updateReserve (deployer, newReserve) {
  // TODO: use deployer.loadASA() to retreive asset manager, reserve
  const asaManager = deployer.accountsByName.get('alice');
  const asaReserve = asaManager; // both reserve & manager are set to alice during deploy
  await fundAccount(deployer, asaManager);

  const asaInfo = deployer.asa.get('gold');
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');

  const escrowParams = {
    TOKEN_ID: asaInfo.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback.py', [], escrowParams);
  const escrowAddress = escrowLsig.address();

  // TODO: update assetConfig tx to only take fields to be modified
  // (we don't need to pass manager, freeze, clawback here)
  const assetModFields = {
    manager: asaManager.addr,
    reserve: newReserve.addr,
    freeze: '',
    clawback: escrowAddress
  };

  const reserveAssetHolding = await balanceOf(deployer, asaReserve.addr, asaInfo.assetIndex);

  /**
   * NOTE: Another way to execute tx is using close_remainder_to property.
   * Transaction group would look like:
   *  tx0: opt-out by the previous reserve to creator (now creator has all assets)
   *  tx1: transfer all tokens from creator to new reserve
   *  tx2: asset config transaction updating reserve address to new one
   */
  const updateReserveParams = [
    /**
     * tx 0 - Asset transfer transaction from current Reserve -> newReserve.
     * The amount is equal to entire asset holding of reserve, i.e we move all asset holdings
     * to the new reserve address.
     */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccount: { addr: escrowAddress },
      recipient: newReserve.addr,
      assetID: asaInfo.assetIndex,
      revocationTarget: asaReserve.addr,
      amount: reserveAssetHolding.amount, // moving all tokens to new reserve
      lsig: escrowLsig,
      payFlags: { totalFee: 1000 }
    },
    /**
     * tx 1 - Asset config transaction to update token reserve to new address. Can only be executed
     * by the asset manager.
     */
    {
      type: types.TransactionType.ModifyAsset,
      sign: types.SignType.SecretKey,
      fromAccount: asaManager,
      assetID: asaInfo.assetIndex,
      fields: assetModFields,
      payFlags: { totalFee: 1000 }
    }
  ];

  console.log(`* Updating reserve address to: ${newReserve.addr} *`);
  await executeTransaction(deployer, updateReserveParams);
  console.log('* Update Successful *');

  // TODO: print ASADef.reserve after updating reserve
}

async function run (runtimeEnv, deployer) {
  const newReserve = deployer.accountsByName.get('bob');
  await fundAccount(deployer, newReserve);

  // opt-in to ASA by new-reserve account
  try {
    await deployer.optInAcountToASA('gold', newReserve.name, {});
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }

  /**
   * Below function updates token reserve (if asa.manager is a single account)
   */
  await updateReserve(deployer, newReserve); // kill token 'gold'

  /**
   * Use below function if asa.manager is a multisig account (as user receive a signed
   * tx file in this case)
   */
  // executeSignedTxnFromFile(deployer, 'new_reserve_out.tx');
}

module.exports = { default: run, updateReserve: updateReserve };
