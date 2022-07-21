const { fundAccount, tryExecuteTx, ProposalType } = require("./common/common.js");
const { accounts } = require("./common/accounts.js");
const { mkProposalTx } = require("./common/tx-params.js");

// TODO: This script should be remove after we support run algob with custom args.
async function addProposal(runtimeEnv, deployer) {
	// NOTE: One account only can create one proposal!
	const { _, proposer } = accounts(deployer);

	// fund account
	await fundAccount(deployer, proposer);

	const daoAppInfo = deployer.getApp("DAOApp");
	const proposalLsig = deployer.getLsig("proposalLsig");
	try {
		await deployer.optInLsigToApp(daoAppInfo.appID, proposalLsig, {}, {});
	} catch (e) {
		console.log(e.message);
	}

	const daoFundLsig = deployer.getLsig("daoFundLsig");
	const govToken = deployer.asa.get("gov-token");

	const addProposalTx = mkProposalTx(
		daoAppInfo.appID,
		govToken.assetIndex,
		proposer,
		proposalLsig,
		daoFundLsig,
		{
			proposalType: ProposalType.ASA_TRANSFER,
			assetID: govToken.assetIndex,
		}
	);

	addProposalTx[1].amount = 15; // deposit is set as 15 in DAO App
	let receipts = await tryExecuteTx(deployer, addProposalTx);
	console.log("New proposal ID = ", receipts[0].txID);
}

module.exports = { default: addProposal };
