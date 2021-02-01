/**
 * Description:
 * This file deploys the stateful smart contract to create and transfer NFT
*/
const { TransactionType, SignType } = require('@algorand-builder/runtime/build/types');
const { executeTransaction } = require('./transfer/common');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const john = deployer.accountsByName.get('john');

  const algoTxnParams = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: john.addr,
    amountMicroAlgos: 401000000, // 401 algos
    payFlags: { note: 'funding account' }
  };

  await executeTransaction(deployer, algoTxnParams); // fund john

  await deployer.deploySSC('nft_approval.py', 'nft_clear_state.py', {
    sender: masterAccount,
    localInts: 16,
    globalInts: 1,
    globalBytes: 63
  }, {});

  const sscInfo = await deployer.getSSC('nft_approval.py', 'nft_clear_state.py');
  const appId = sscInfo.appID;
  console.log(sscInfo);

  try {
    await deployer.optInToSSC(masterAccount, appId, {}, {}); // opt-in to asc by master
    await deployer.optInToSSC(john, appId, {}, {}); // opt-in to asc by john
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
}

module.exports = { default: run };
