const { tryExecuteTx } = require("./common/common.js");
const { accounts } = require("./common/accounts.js");
const { mkWithdrawFromProposalTx } = require("./common/tx-params.js");

async function withdrawFromProposal(deployer, proposalLsig, proposer, voterA) {
	const govTokenID = deployer.asa.get("gov-token").assetIndex;
	console.log("gov token id: ", govTokenID);

	const withdrawTx = mkWithdrawFromProposalTx(proposer, govTokenID, proposalLsig, 10);
	const withdrawTxFail = mkWithdrawFromProposalTx(voterA, govTokenID, proposalLsig, 10);

	console.log(`* Withdrawing from proposalLsig ${proposalLsig.address()}  to owner account *`); //Should succeed
	await tryExecuteTx(deployer, withdrawTx);

	console.log(
		`* Withdrawing from proposalLsig ${proposalLsig.address()}  to non-owner account *`
	); //Should fail
	await tryExecuteTx(deployer, withdrawTxFail).catch((error) => {
		console.log(error);
	});
}

async function run(runtimeEnv, deployer) {
	const { _, proposer, voterA } = accounts(deployer);
	const proposalLsig = deployer.getLsig("proposalLsig");

	await withdrawFromProposal(deployer, proposalLsig, proposer, voterA);
}

module.exports = { default: run };
