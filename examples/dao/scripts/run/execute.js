const { tryExecuteTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { accounts, getDAOFundLsig, getProposalLsig } = require('./common/accounts.js');

// Executes a proposal
async function execute (deployer, account, proposalAddr) {
  const daoFundLsig = await getDAOFundLsig(deployer);
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');

  console.log(`* Execute proposal by ${account.addr} *`);
  const executeParams = [
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: account,
      appID: daoAppInfo.appID,
      payFlags: { totalFee: 2000 },
      appArgs: ['str:execute'],
      accounts: [proposalAddr]
    },
    // tx1 as per proposal instructions (set in ./add_proposal.js)
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: daoFundLsig.address(),
      toAccountAddr: account.addr,
      amountMicroAlgos: 2e6,
      lsig: daoFundLsig,
      payFlags: { totalFee: 0 } // fee must be paid by proposer
    }
  ];

  await tryExecuteTx(deployer, executeParams);
}

async function run (runtimeEnv, deployer) {
  const { _, proposer } = accounts(deployer);
  const proposalLsig = await getProposalLsig(deployer);

  // execute proposal
  await execute(deployer, proposer, proposalLsig.address());
}

module.exports = { default: run };
