const { tryExecuteTx } = require("./common/common.js");
const { accounts } = require("./common/accounts.js");
const { mkDepositVoteTokenTx } = require("./common/tx-params.js");

async function depositVote(deployer, voterAcc, amt) {
	const daoAppInfo = deployer.getApp("DAOApp");
	const govToken = deployer.asa.get("gov-token");

	// opt-in to App by voterAcc
	try {
		await deployer.optInAccountToApp(voterAcc, daoAppInfo.appID, {}, {});
	} catch (e) {
		console.log(e.message); // already opted in
	}

	console.log(`* Deposit ${amt} votes by ${voterAcc.addr} *`);
	const depositVoteParam = mkDepositVoteTokenTx(
		daoAppInfo.appID,
		govToken.assetIndex,
		voterAcc,
		amt
	);

	await tryExecuteTx(deployer, depositVoteParam);
}

async function run(runtimeEnv, deployer) {
	const { _, __, voterA, voterB } = accounts(deployer);

	// deposit votes by voterA & voterB
	await depositVote(deployer, voterA, 6);
	await depositVote(deployer, voterB, 8);
}

module.exports = { default: run };
