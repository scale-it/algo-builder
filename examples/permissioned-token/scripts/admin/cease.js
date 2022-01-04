const {
  balanceOf, executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

const accounts = require('../common/accounts');
const { getClawback, fundAccount, optInAccountToApp } = require('../common/common');
const { issue } = require('./issue');
const { whitelist } = require('../permissions/whitelist');

const clearStateProgram = 'clear_state_program.py';

/**
 * If there is a crime evidence, we will need to be able to cease assets back to the issuer.
 * NOTE: this is similar to force transfer, but receiver is the asset-reserve.
 * @param {string} address address to cease tokens from
 * @param {number | bigint} amount amount of tokens to cease
 */
async function cease (deployer, address, amount) {
  const owner = deployer.accountsByName.get(accounts.owner);
  const tesla = deployer.asa.get('tesla');
  const controllerAppInfo = deployer.getApp('controller.py', clearStateProgram);

  const clawbackLsig = await getClawback(deployer);
  const clawbackAddress = clawbackLsig.address();
  const asaReserveAddress = (await deployer.getAssetByID(tesla.assetIndex)).params.reserve;

  // similar to forceTransfer group, but receiver is asaReserveAddress, and call to permissions
  // is not required
  const ceaseTxGroup = [
    /*
     * tx 0 - Call to controller stateful smart contract (by ASA.manager)
     * with application arg: 'force_transfer' */
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
     * tx 1 - Asset transfer transaction from sender -> receiver (= asset reserve), using clawbackLsig. */
    {
      type: types.TransactionType.RevokeAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: clawbackAddress,
      recipient: asaReserveAddress,
      assetID: tesla.assetIndex,
      revocationTarget: address,
      amount: amount,
      lsig: clawbackLsig,
      payFlags: { totalFee: 1000 }
    },
    /*
     * tx 2 - cover fee of tx1 */
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: owner,
      toAccountAddr: clawbackAddress,
      amountMicroAlgos: 1000,
      payFlags: { totalFee: 1000 }
    }
  ];

  console.log(`* Ceasing ${amount} tokens from [${address}] *`);
  await executeTransaction(deployer, ceaseTxGroup);

  console.log(`* ${address} asset holding after cease: *`);
  console.log(await balanceOf(deployer, address, tesla.assetIndex));

  console.log('* Cease Successful *');
}

async function run (runtimeEnv, deployer) {
  const owner = deployer.accountsByName.get(accounts.owner);
  const permissionsManager = owner;
  const permissionsAppInfo = deployer.getApp('permissions.py', clearStateProgram);

  // fund owner and bob
  const bob = deployer.accountsByName.get('bob');
  await fundAccount(deployer, [owner, bob]);

  // whitelist bob
  optInAccountToApp(deployer, bob, permissionsAppInfo.appID, {}, {});
  await whitelist(deployer, permissionsManager, bob.addr);

  // let's issue few tokens to bob
  deployer.optInAccountToASA('tesla', bob.name, {});
  await issue(deployer, bob.addr, 300);

  // cease 250 tokens as penalty back from bob (eg. bob was fired)
  await cease(deployer, bob.addr, 250);
}

module.exports = { default: run };
