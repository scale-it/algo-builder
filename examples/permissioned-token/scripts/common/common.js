const { executeTransaction, balanceOf } = require('@algo-builder/algob');
const { types } = require('@algo-builder/web');

exports.executeTransaction = async function (deployer, txnParams) {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e);
  }
};

/**
 * Fund accounts from master with 20 Algos
 * @param {*} deployer algobDeployer
 * @param {*} account or list of accounts to fund
 */
exports.fundAccount = async function (deployer, account) {
  const master = deployer.accountsByName.get('master-account');
  const params = [];
  if (!(account instanceof Array)) {
    account = [account];
  }
  for (const a of account) {
    console.log(`* Funding Account: ${a.name} *`);
    params.push({
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master,
      toAccountAddr: a.addr,
      amountMicroAlgos: 20e6,
      payFlags: { totalFee: 1000, note: 'funding account' }
    });
  }

  try {
    await executeTransaction(deployer, params);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error.text : e);
  }
};

exports.optInAccountToApp = async function (deployer, account, appID, payflags, AppOptionalFlags) {
  try {
    console.log(`* Opting In: ${account.name} to App with application index: ${appID} *`);
    await deployer.optInAccountToApp(account, appID, payflags, AppOptionalFlags);
  } catch (e) {
    console.error('optInAccountToApp failed', e.response?.error); // probably app already optedIn
  }
};

// returns totalSupply of asset (0 after deployment, will increase with each issuance transaction)
exports.totalSupply = async function (deployer, assetIndex) {
  const asaDef = (await deployer.getAssetByID(assetIndex)).params;
  const reserveAssetHoldingAmount = await balanceOf(deployer, asaDef.reserve, assetIndex);
  return BigInt(asaDef.total) - BigInt(reserveAssetHoldingAmount);
};

function getClawbackParams (deployer) {
  const tesla = deployer.asa.get('tesla');
  const controllerInfo = deployer.getApp('controller.py', 'clear_state_program.py');
  return {
    TOKEN_ID: tesla.assetIndex,
    CONTROLLER_APP_ID: controllerInfo.appID
  };
}

exports.getClawbackParams = getClawbackParams;

exports.getClawback = async (deployer) =>
  deployer.loadLogic('clawback.py', getClawbackParams(deployer));
