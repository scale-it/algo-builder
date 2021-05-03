const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { executeTransaction, fundAccount } = require('../common/common');

// here instead of updating the asset reserve by modifyAsset tx,
// we just rekey old reserve account to new reserve
async function updateReserveByRekeying (deployer, newReserve) {
  // note: update reserve account below if not alice
  const asaReserve = deployer.accountsByName.get('alice');
  await fundAccount(deployer, asaReserve);

  // Rekey oldReserve to newReserve
  const rekeyReserveParam = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: asaReserve,
    toAccountAddr: asaReserve.addr,
    amountMicroAlgos: 0,
    payFlags: { totalFee: 1000, rekeyTo: newReserve.addr }
  };

  console.log(`* Rekeying reserve address from: ${asaReserve.addr} to: ${newReserve.addr} *`);
  await executeTransaction(deployer, rekeyReserveParam);
  console.log('* Rekeying Successful *');
}

/**
* NOTE: this function is for demonstration purpose only (if ASA manager is a single account)
* If asset manager is a multisig address, then user will receive a valid tx file, 
* add his own signature, by using CLI command `algob sign-multisig` or exported function `signMultiSig`, & send it to network.
*  - Use `algob.executeSignedTxnFromFile` to execute tx from file
*  - Use below function if asa.manager is single account
*/
async function updateReserveByAssetConfig (deployer, newReserve) {
  const asaManager = deployer.accountsByName.get('alice');
  await fundAccount(deployer, asaManager);

  // fetch old asset reserve from network by assetId
  const asaInfo = deployer.asa.get('gold');
  const asaReserveAddr = (await deployer.getAssetByID(asaInfo.assetIndex)).params.reserve;
  const controllerSSCInfo = deployer.getSSC('controller.py', 'clear_state_program.py');

  const escrowParams = {
    TOKEN_ID: asaInfo.assetIndex,
    CONTROLLER_APP_ID: controllerSSCInfo.appID
  };

  const escrowLsig = await deployer.loadLogic('clawback.py', [], escrowParams);
  const escrowAddress = escrowLsig.address();
  const reserveAssetHolding = await balanceOf(deployer, asaReserveAddr, asaInfo.assetIndex);

  console.log('Asset reserve address before: ', asaReserveAddr);

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
      fromAccountAddr: escrowAddress,
      recipient: newReserve.addr,
      assetID: asaInfo.assetIndex,
      revocationTarget: asaReserveAddr,
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
      fields: { reserve: newReserve.addr },
      payFlags: { totalFee: 1000 }
    }
  ];

  console.log(`* Updating reserve address to: ${newReserve.addr} *`);
  await executeTransaction(deployer, updateReserveParams);
  console.log('* Update Successful *');

  console.log('Asset reserve address after updating reserve: ',
    (await deployer.getAssetByID(asaInfo.assetIndex)).params.reserve);
}

async function run (runtimeEnv, deployer) {
  const newReserve = deployer.accountsByName.get('elon-musk');
  // await fundAccount(deployer, newReserve);

  // opt-in to ASA by new-reserve account
  try {
    await deployer.optInAcountToASA('gold', newReserve.name, {});
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }

  /**
   * Approach 1 (group of 2 tx):
   * - tx0: Move all tokens from oldReserve to newReserve
   * - tx1: Update the asset reserve to new reserve address
   */
  // await updateReserveByAssetConfig(deployer, newReserve);

  /**
   * Approach 2: rekey old reserve to new reserve
   * NOTE: now for issuance transaction, fromAccountAddr will be old reserve,
   * but fromAccount (signing authority) will be the new reserve account
   */
  await updateReserveByRekeying(deployer, newReserve);

  /**
   * Use below function if asa.manager is a multisig account (as user receive a signed
   * tx file in this case)
   */
  // executeSignedTxnFromFile(deployer, 'new_reserve_out.tx');
}

module.exports = {
  default: run,
  updateReserveByAssetConfig: updateReserveByAssetConfig,
  updateReserveByRekeying: updateReserveByRekeying
};
