const { tryExecuteTx } = require('./common/common.js');
const { types } = require('@algo-builder/web');
const { getDepositLsig, getProposalLsig, accounts } = require('./common/accounts.js');

async function clearProposal (deployer, proposalLsig, depositAmt) {
  const daoAppInfo = deployer.getApp('dao-app-approval.py', 'dao-app-clear.py');
  const govToken = deployer.asa.get('gov-token');
  const depositLsig = await getDepositLsig(deployer);

  console.log(`* Clearing proposal_lsig record ${proposalLsig.address()} *`);
  const clearProposalParam = [
    // tx0: call to DAO App with arg 'clear_proposal'
    {
      type: types.TransactionType.CallApp,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: proposalLsig.address(),
      appID: daoAppInfo.appID,
      lsig: proposalLsig,
      payFlags: { totalFee: 2000 },
      appArgs: ['str:clear_proposal']
    },
    // tx1: withdraw deposit from deposit_lsig back to proposalLsig
    {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: depositLsig.address(),
      toAccountAddr: proposalLsig.address(),
      amount: depositAmt,
      lsig: depositLsig,
      assetID: govToken.assetIndex,
      payFlags: { totalFee: 0 } // fees paid by proposalLsig in tx0
    }
  ];

  await tryExecuteTx(deployer, clearProposalParam);
}

async function run (runtimeEnv, deployer) {
  const { _, proposer } = accounts(deployer);
  const govToken = deployer.asa.get('gov-token');
  const proposalLsig = await getProposalLsig(deployer);

  // optIn to ASA(GOV_TOKEN) by proposalLsig
  // we will receive the deposit back into proposalLsig
  const optInTx = [
    {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: proposer,
      toAccountAddr: proposalLsig.address(),
      amountMicroAlgos: 0,
      payFlags: {}
    },
    {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: proposalLsig.address(),
      lsig: proposalLsig,
      assetID: govToken.assetIndex,
      payFlags: {}
    }
  ];
  await tryExecuteTx(deployer, optInTx);

  // Transaction FAIL: deposit amount is not the same as app.global("deposit")
  await clearProposal(deployer, proposalLsig, 7);

  // clear proposal record
  await clearProposal(deployer, proposalLsig, 15);
}

module.exports = { default: run };
