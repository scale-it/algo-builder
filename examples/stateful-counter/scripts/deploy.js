const {
  executeTransaction
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const creatorAccount = deployer.accountsByName.get('alice');

  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: creatorAccount.addr,
    amountMicroAlgos: 200e6,
    payFlags: {}
  };
  // transfer some algos to creator account
  await executeTransaction(deployer, algoTxnParams);

  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  const sscInfo = await deployer.deploySSC(
    'approval_program.teal', // approval program
    'clear_program.teal', // clear program
    {
      sender: creatorAccount,
      localInts: 1,
      localBytes: 1,
      globalInts: 1,
      globalBytes: 1
    }, {});

  console.log(sscInfo);

  // Opt-In for creator
  await deployer.optInToSSC(creatorAccount, sscInfo.appID, {}, {});
}

module.exports = { default: run };
