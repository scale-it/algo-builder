const {
  executeTransaction,
  updateSSC,
  uint64ToBigEndian,
  addressToPk
} = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');

async function run (runtimeEnv, deployer) {
  const masterAccount = deployer.accountsByName.get('master-account');
  const creatorAccount = deployer.accountsByName.get('alice');
  const donorAccount = deployer.accountsByName.get('john');

  const algoTxnParams = {
    type: types.TransactionType.TransferAlgo,
    sign: types.SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: creatorAccount.addr,
    amountMicroAlgos: 200000000,
    payFlags: {}
  };
  await executeTransaction(deployer, algoTxnParams);
  algoTxnParams.toAccountAddr = donorAccount.addr;
  await executeTransaction(deployer, algoTxnParams);

  // Get begin date to pass in
  const beginDate = Math.round(new Date().getTime() / 1000);
  // Get end date to pass in
  const endDate = Math.round(new Date().getTime() / 1000) + 200;
  // Get fund close date to pass in
  const fundCloseDate = endDate + 400;

  // initialize app arguments
  let appArgs = [
    uint64ToBigEndian(beginDate),
    uint64ToBigEndian(endDate),
    'int:7000000', // args similar to `goal --app-arg ..` are also supported
    addressToPk(creatorAccount.addr),
    uint64ToBigEndian(fundCloseDate)
  ];

  // Create Application
  // Note: An Account can have maximum of 10 Applications.
  const sscInfo = await deployer.deploySSC(
    'crowdFundApproval.teal', // approval program
    'crowdFundClear.teal', // clear program
    {
      sender: creatorAccount,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3,
      appArgs: appArgs
    }, {});

  console.log(sscInfo);

  // Get Escrow Account Address
  const escrowAccount = await deployer.loadLogic('crowdFundEscrow.py', { APP_ID: sscInfo.appID });
  console.log('Escrow Account Address:', escrowAccount.address());

  // Update application with escrow account
  // Note: that the code for the contract will not change.
  // The update operation links the two contracts.
  const applicationID = sscInfo.appID;

  appArgs = [addressToPk(escrowAccount.address())];

  const updatedRes = await updateSSC(
    deployer,
    creatorAccount,
    {}, // pay flags
    applicationID,
    'crowdFundApproval.teal',
    'crowdFundClear.teal',
    { appArgs: appArgs }
  );
  console.log('Application Updated: ', updatedRes);

  console.log('Opting-In for Creator and Donor.');
  try {
    await deployer.optInAccountToSSC(creatorAccount, applicationID, {}, {});
    await deployer.optInAccountToSSC(donorAccount, applicationID, {}, {});
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
  console.log('Opt-In successful.');
}

module.exports = { default: run };
