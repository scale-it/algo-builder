const {
  balanceOf
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');
const { getClawback, executeTransaction } = require('../common/common');
const accounts = require('../common/accounts');

// here instead of updating the asset reserve by modifyAsset tx,
// we use rekey transaction for the reserve account.
async function updateReserveByRekeying (deployer, address) {
  const owner = deployer.accountsByName.get(accounts.owner);

  // Rekey oldReserve to newReserve
  const rekeyReserveParam = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: owner,
    toAccountAddr: owner.addr,
    amountMicroAlgos: 0,
    payFlags: { totalFee: 1000, rekeyTo: address }
  };

  console.log(`* Rekeying reserve address from: ${owner.addr} to: ${address} *`);
  await executeTransaction(deployer, rekeyReserveParam);
  console.log('* Rekeying Successful *');
}

async function updateReserveByAssetConfig (deployer, address) {
  const owner = deployer.accountsByName.get(accounts.owner);

  // fetch old asset reserve from network by assetId
  const tesla = deployer.asa.get('tesla');
  const asaReserveAddr = (await deployer.getAssetByID(tesla.assetIndex)).params.reserve;
  const controllerAppInfo = deployer.getApp('controller.py', 'clear_state_program.py');

  const clawbackLsig = await getClawback(deployer);
  const clawbackAddress = clawbackLsig.address();
  const reserveAssetHoldingAmount = await balanceOf(deployer, asaReserveAddr, tesla.assetIndex);

  console.log('Asset reserve address before: ', asaReserveAddr);

  /*
   * NOTE: Another way to execute tx is using close_remainder_to property.
   * Transaction group would look like:
   *  tx0: opt-out by the previous reserve to creator (now creator has all assets)
   *  tx1: transfer all tokens from creator to new reserve
   *  tx2: asset config transaction updating reserve address to new one
   */
  const updateReserveParams = [
    /*
     * tx 0 - Call to controller stateful smart contract with application arg: 'transfer'
     * The contract ensures that there is a call to permissions smart contract in the txGroup,
     * so that rules are checked during token transfer. The smart contract also checks each transaction
     * params in the txGroup (eg. sender(tx1) === receiver(tx2) === clawbackAddress)
     */
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: owner,
      appID: controllerAppInfo.appID,
      payFlags: { totalFee: 1000 },
      appArgs: ['str:force_transfer'],
      foreignAssets: [tesla.assetIndex] // to verify token reserve, manager
    },
    /*
     * tx 1 - Asset transfer transaction from current Reserve -> address.
     * The amount is equal to entire asset holding of reserve, i.e we move all asset holdings
     * to the new reserve address.
     */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: clawbackAddress,
      recipient: address,
      assetID: tesla.assetIndex,
      revocationTarget: asaReserveAddr,
      amount: reserveAssetHoldingAmount, // moving all tokens to new reserve
      lsig: clawbackLsig,
      payFlags: { totalFee: 1000 }
    },
    /*
     * tx 2 - Payment transaction of 1000 microAlgo to cover clawback transaction cost (tx 1).
     */
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: owner,
      toAccountAddr: clawbackAddress,
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    },
    /*
     * tx 3 (last tx) - Asset config transaction to update token reserve to new address. Can only be executed
     * by the asset manager.
     */
    {
      type: types.TransactionType.ModifyAsset,
      sign: types.SignType.SecretKey,
      fromAccount: owner,
      assetID: tesla.assetIndex,
      fields: { reserve: address },
      payFlags: { totalFee: 1000 }
    }
  ];

  console.log(`* Updating reserve address to: ${address} *`);
  await executeTransaction(deployer, updateReserveParams);
  console.log('* Update Successful *');

  console.log('Asset reserve address after updating reserve: ',
    (await deployer.getAssetByID(tesla.assetIndex)).params.reserve);
}

async function run (runtimeEnv, deployer) {
  const newReserve = deployer.accountsByName.get('elon-musk');
  // await fundAccount(deployer, newReserve);

  try {
    await deployer.optInAccountToASA('tesla', newReserve.name, {});
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }

  /*
   * Approach 1 (group of 2 tx):
   * a): Move all tokens from oldReserve to newReserve (by force_transfer)
   * b): Update the asset reserve to new reserve address
   */
  await updateReserveByAssetConfig(deployer, newReserve.addr);

  /*
   * Approach 2: rekey old reserve to new reserve
   * NOTE: now for issuance transaction, fromAccountAddr will be old reserve,
   * but fromAccount (signing authority) will be the new reserve account
   */
  // await updateReserveByRekeying(deployer, newReserve.addr);
}

module.exports = {
  default: run,
  updateReserveByAssetConfig: updateReserveByAssetConfig,
  updateReserveByRekeying: updateReserveByRekeying
};
