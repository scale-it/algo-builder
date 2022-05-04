const { tryExecuteTx } = require("./common/common.js");
const { types } = require("@algo-builder/web");
const { accounts } = require("./common/accounts.js");
const { mkCloseProposalTx } = require("./common/tx-params.js");

async function closeProposal(deployer, proposalLsig, depositAmt) {
	const daoAppInfo = deployer.getApp("DAOApp");
	const govToken = deployer.asa.get("gov-token");

	console.log(`* Closing proposal_lsig ${proposalLsig.address()} *`);
	const closeProposalParam = mkCloseProposalTx(
		daoAppInfo.appID,
		govToken.assetIndex,
		proposalLsig
	);

	await tryExecuteTx(deployer, closeProposalParam);
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

	// Transaction will FAIL: deposit amount is not the same as app.global("deposit")
	await closeProposal(deployer, proposalLsig, 7);

	// Transaction will SUCCEED
	await closeProposal(deployer, proposalLsig, 15);
}

module.exports = { default: run };
