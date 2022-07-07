const { fundAccount, tryExecuteTx } = require("./common/common.js");
const { accounts } = require("./common/accounts.js");
const { mkProposalTx } = require("./common/tx-params.js");

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
		daoFundLsig
	);

	// Transaction FAIL (asset_transfer amount is less than min_deposit)
	await tryExecuteTx(deployer, addProposalTx);

	// Transaction PASS
	addProposalTx[1].amount = 15; // deposit is set as 15 in DAO App
	let receipts = await tryExecuteTx(deployer, addProposalTx);
	console.log("New proposal ID = ", receipts[0].txID);
}

module.exports = { default: addProposal };
