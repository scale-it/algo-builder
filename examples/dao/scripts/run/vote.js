const { tryExecuteTx, Vote } = require("./common/common.js");
const { types } = require("@algo-builder/web");
const { accounts } = require("./common/accounts.js");

async function registerVote(deployer, voterAcc, proposalAddr, voteType) {
	const daoAppInfo = deployer.getApp("DAOApp");

	console.log(`* Register votes by ${voterAcc.addr} *`);
	// call to DAO app by voter (to register deposited votes)
	const registerVoteParam = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: voterAcc,
		appID: daoAppInfo.appID,
		payFlags: { totalFee: 2000 },
		appArgs: ["str:register_vote", `str:${voteType}`],
		accounts: [proposalAddr],
	};

	await tryExecuteTx(deployer, registerVoteParam);
}

async function run(runtimeEnv, deployer) {
	const { _, __, voterA, voterB } = accounts(deployer);
	const proposalLsig = deployer.getLsig("proposalLsig");

	// register votes (deposited in ./deposit_vote_token.js)
	await registerVote(deployer, voterA, proposalLsig.address(), Vote.YES);
	await registerVote(deployer, voterB, proposalLsig.address(), Vote.ABSTAIN);

	// Transaction FAIL: voterA tries to register deposited votes again
	await registerVote(deployer, voterA, proposalLsig.address(), Vote.YES);
}

module.exports = { default: run };
