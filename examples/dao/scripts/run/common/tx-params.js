const { types } = require("@algo-builder/web");
const { ProposalType, DAOActions, ExampleProposalConfig } = require("./common");
const { getApplicationAddress } = require("algosdk");

const now = Math.round(new Date().getTime() / 1000);

const votingStart = now + 1 * 60;
const votingEnd = now + 3 * 60;
const executeBefore = now + 7 * 60;

function mkProposalTx(daoAppID, govTokenID, proposerAcc, proposalLsig, daoFundLsig) {
	const proposerAddr = proposerAcc.addr ?? proposerAcc.address;
	const proposalParams = [
		DAOActions.addProposal,
		`str:${ExampleProposalConfig.name}`, // name
		`str:${ExampleProposalConfig.URL}`, // url
		`str:${ExampleProposalConfig.URLHash}`, // url_hash
		"str:", // hash_algo (passing null)
		`int:${votingStart}`, // voting_start (now + 1min)
		`int:${votingEnd}`, // voting_end (now + 3min)
		`int:${executeBefore}`, // execute_before (now + 7min)
		`int:${ProposalType.ALGO_TRANSFER}`, // type
		`addr:${daoFundLsig.address()}`, // from (DAO treasury)
		`addr:${proposerAddr}`, // recepient
		`int:${2e6}`, // amount (in microalgos)
	];

	return [
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: proposalLsig.address(),
			appID: daoAppID,
			lsig: proposalLsig,
			payFlags: {},
			appArgs: proposalParams,
		},
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: proposerAcc, // note: this can be any account
			toAccountAddr: getApplicationAddress(daoAppID),
			amount: 10, // (fails) as deposit is set as 15
			assetID: govTokenID,
			payFlags: { totalFee: 1000 },
		},
	];
}

function mkDepositVoteTokenTx(daoAppID, govTokenID, voterAcc, amount) {
	return [
		// tx0: call to DAO App with arg 'deposit_vote_token'
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: voterAcc,
			appID: daoAppID,
			payFlags: { totalFee: 1000 },
			appArgs: [DAOActions.depositVoteToken],
		},
		// tx1: deposit votes (each token == 1 vote)
		{
			type: types.TransactionType.TransferAsset,
			sign: types.SignType.SecretKey,
			fromAccount: voterAcc, // note: this can be any account
			toAccountAddr: getApplicationAddress(daoAppID),
			amount: amount,
			assetID: govTokenID,
			payFlags: { totalFee: 1000 },
		},
	];
}

function mkWithdrawVoteDepositTx(daoAppID, govTokenID, voterAcc, amount) {
	return {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: voterAcc,
		appID: daoAppID,
		payFlags: { totalFee: 2000 },
		appArgs: [DAOActions.withdrawVoteDeposit, `int:${amount}`],
		foreignAssets: [govTokenID],
	};
}

function mkClearVoteRecordTx(daoAppID, voterAcc, proposalAddr) {
	return {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: voterAcc,
		appID: daoAppID,
		payFlags: { totalFee: 1000 },
		appArgs: [DAOActions.clearVoteRecord],
		accounts: [proposalAddr],
	};
}

function mkClearProposalTx(daoAppID, govTokenID, proposalLsig) {
	return {
		type: types.TransactionType.CallApp,
		sign: types.SignType.LogicSignature,
		fromAccountAddr: proposalLsig.address(),
		appID: daoAppID,
		lsig: proposalLsig,
		payFlags: { totalFee: 2000 },
		appArgs: [DAOActions.clearProposal],
		foreignAssets: [govTokenID],
	};
}

module.exports = {
	mkProposalTx,
	mkDepositVoteTokenTx,
	mkWithdrawVoteDepositTx,
	mkClearVoteRecordTx,
	mkClearProposalTx,
	now,
	votingStart,
	votingEnd,
	executeBefore,
};
