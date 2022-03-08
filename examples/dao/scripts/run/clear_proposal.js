const { tryExecuteTx } = require("./common/common.js");
const { types } = require("@algo-builder/web");
const { accounts } = require("./common/accounts.js");
const { mkClearProposalTx } = require("./common/tx-params.js");

async function clearProposal(deployer, proposalLsig, depositAmt) {
	const daoAppInfo = deployer.getApp("DAOApp");
	const govToken = deployer.asa.get("gov-token");

	console.log(`* Clearing proposal_lsig record ${proposalLsig.address()} *`);
	const clearProposalParam = mkClearProposalTx(
		daoAppInfo.appID,
		govToken.assetIndex,
		proposalLsig
	);

	await tryExecuteTx(deployer, clearProposalParam);
}

async function run(runtimeEnv, deployer) {
	const { _, proposer } = accounts(deployer);
	const govToken = deployer.asa.get("gov-token");
	const proposalLsig = deployer.getLsig("proposalLsig");

	// optIn to ASA(GOV_TOKEN) by proposalLsig
	// we will receive the deposit back into proposalLsig
	const optInTx = [
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: proposer,
			toAccountAddr: proposalLsig.address(),
			amountMicroAlgos: 0,
			payFlags: {},
		},
		{
			type: types.TransactionType.OptInASA,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: proposalLsig.address(),
			lsig: proposalLsig,
			assetID: govToken.assetIndex,
			payFlags: {},
		},
	];
	await tryExecuteTx(deployer, optInTx);

	// Transaction FAIL: deposit amount is not the same as app.global("deposit")
	await clearProposal(deployer, proposalLsig, 7);

	// clear proposal record
	await clearProposal(deployer, proposalLsig, 15);
}

module.exports = { default: run };
