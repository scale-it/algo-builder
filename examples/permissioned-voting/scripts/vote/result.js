const { readGlobalStateSSC } = require('@algo-builder/algob');
const { types } = require('@algo-builder/runtime');
const { executeTransaction } = require('./common');

async function run (runtimeEnv, deployer) {
  const votingAdminAccount = deployer.accountsByName.get('john');
  const alice = deployer.accountsByName.get('alice');

  // Retreive AppInfo from checkpoints.
  const appInfo = deployer.getSSC('permissioned-voting-approval.py', 'permissioned-voting-clear.py');

  // Retreive Global State
  const globalState = await readGlobalStateSSC(deployer, votingAdminAccount.addr, appInfo.appID);
  console.log(globalState);

  // Count votes
  let candidateA = 0; let candidateB = 0;
  let key;
  for (const l of globalState) {
    key = Buffer.from(l.key, 'base64').toString();
    console.log(`"${key}": ${l.value.uint}`);
    if (key === 'candidatea') {
      candidateA = l.value.uint;
    }
    if (key === 'candidateb') {
      candidateB = l.value.uint;
    }
  }

  // Declare Winner
  if (candidateA > candidateB) {
    console.log('The Winner is CandidateA!!');
  } else if (candidateA === candidateB) {
    console.log('Election Result is a tie.');
  } else {
    console.log('The Winner is CandidateA!!');
  }

  const txnParam = {
    type: types.TransactionType.DeleteSSC,
    sign: types.SignType.SecretKey,
    fromAccount: votingAdminAccount,
    appId: appInfo.appID,
    payFlags: {}
  };

  // Delete Application
  console.log('Deleting Application');
  await executeTransaction(deployer, txnParam);

  txnParam.fromAccount = alice;
  txnParam.type = types.TransactionType.ClearSSC;

  // Clear voter's account
  console.log("Clearing Alice's Account");
  await executeTransaction(deployer, txnParam);
}

module.exports = { default: run };
