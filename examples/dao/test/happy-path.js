const { AccountStore } = require("@algo-builder/runtime");
const { types, parsing } = require("@algo-builder/web");
const { assert } = require("chai");
const { Context, initialBalance, minSupport, deposit } = require("./common");
const { ProposalType, Vote } = require("../scripts/run/common/common");
const {
	mkProposalTx,
	mkDepositVoteTokenTx,
	votingStart,
	votingEnd,
	executeBefore,
	mkWithdrawVoteDepositTx,
	mkClearVoteRecordTx,
	mkCloseProposalTx,
} = require("../scripts/run/common/tx-params");

describe("DAO - Happy Paths", function () {
	let master, creator, proposer, voterA, voterB;
	let daoFundLsigAcc, proposalLsigAcc;
	let ctx;

	function setUpCtx() {
		master = new AccountStore(1000e6);
		creator = new AccountStore(initialBalance);
		proposer = new AccountStore(initialBalance);
		voterA = new AccountStore(initialBalance);
		voterB = new AccountStore(initialBalance);
		daoFundLsigAcc = new AccountStore(initialBalance);
		proposalLsigAcc = new AccountStore(initialBalance);

		ctx = new Context(
			master,
			creator,
			proposer,
			voterA,
			voterB,
			daoFundLsigAcc,
			proposalLsigAcc
		);
	}

	// reset context:
	// + opt-in's
	// + add proposal
	// + deposit vote tokens
	// + vote
	// + execute proposal
	// NOTE: contract calls are not involved here
	function resetCtx() {
		// set up context
		setUpCtx();

		// optIn's
		ctx.optInToDAOApp(ctx.proposalLsig.address());
		ctx.optInToDAOApp(ctx.voterA.address);
		ctx.optInToDAOApp(ctx.voterB.address);
		ctx.syncAccounts();

		// add proposal
		ctx.addProposal();

		// deposit & register yes votes (by A)
		ctx.depositVoteToken(ctx.voterA, 5);
		ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

		// deposit & register yes votes (by B)
		ctx.depositVoteToken(ctx.voterB, 7);
		ctx.vote(ctx.voterB, Vote.YES, ctx.proposalLsigAcc);

		// execute proposal
		ctx.executeProposal(ctx.proposalLsigAcc);
	}

	describe("Add proposal", function () {
		let proposalParams, addProposalTx;
		this.beforeEach(() => {
			setUpCtx();

			proposalParams = [
				"str:add_proposal",
				"str:my-custom-proposal", // name
				"str:www.myurl.com", // url
				"str:url-hash", // url_hash
				"str:", // hash_algo (passing null)
				`int:${votingStart}`, // votingStart (now + 1min)
				`int:${votingEnd}`, // votingEnd (now + 3min)
				`int:${executeBefore}`, // executeBefore (now + 7min)
				`int:${ProposalType.ALGO_TRANSFER}`, // type
				`addr:${ctx.daoFundLsig.address()}`, // from (DAO treasury)
				`addr:${ctx.proposer.address}`, // recepient
				`int:${2e6}`, // amount (in microalgos)
			];

			addProposalTx = mkProposalTx(
				ctx.daoAppID,
				ctx.govTokenID,
				ctx.proposer.account,
				ctx.proposalLsig,
				ctx.daoFundLsig
			);
			// update transfer amount of proposal deposit tx
			addProposalTx[1].amount = deposit;

			ctx.optInToDAOApp(ctx.proposalLsig.address()); // opt-in
		});

		it("should save proposal config in proposalLsig for ALGO transfer (type == 1)", () => {
			ctx.executeTx(addProposalTx);
			ctx.syncAccounts();

			// assert proposal config is added
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "name"),
				parsing.stringToBytes("my-custom-proposal")
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "url"),
				parsing.stringToBytes("www.myurl.com")
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "url_hash"),
				parsing.stringToBytes("url-hash")
			);
			// empty hash_algo must save sha256
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "hash_algo"),
				parsing.stringToBytes("sha256")
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "voting_start"),
				BigInt(votingStart)
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "voting_end"),
				BigInt(votingEnd)
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "execute_before"),
				BigInt(executeBefore)
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "type"),
				BigInt(ProposalType.ALGO_TRANSFER)
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "from"),
				parsing.addressToPk(ctx.daoFundLsig.address())
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "recipient"),
				parsing.addressToPk(ctx.proposer.address)
			);
			assert.deepEqual(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "amount"), BigInt(2e6));
		});

		it("should save proposal config in proposalLsig for ASA transfer (type == 2)", () => {
			addProposalTx[0].appArgs = [
				...proposalParams.splice(0, 8),
				`int:${ProposalType.ASA_TRANSFER}`, // type
				`addr:${ctx.daoFundLsig.address()}`, // from (DAO treasury)
				`int:${ctx.govTokenID}`, // ASA ID
				`addr:${ctx.proposer.address}`, // recepient
				`int:${10}`, // no. of ASA
			];

			ctx.executeTx(addProposalTx);
			ctx.syncAccounts();

			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "type"),
				BigInt(ProposalType.ASA_TRANSFER)
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "from"),
				parsing.addressToPk(ctx.daoFundLsig.address())
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "asa_id"),
				BigInt(ctx.daoAppID)
			);
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "recipient"),
				parsing.addressToPk(ctx.proposer.address)
			);
			assert.deepEqual(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "amount"), 10n);
		});

		it("should save proposal config in proposalLsig for message (type == 3)", () => {
			addProposalTx[0].appArgs = [
				...proposalParams.splice(0, 8),
				`int:${ProposalType.MESSAGE}`, // type
				"str:my-message",
			];
			ctx.executeTx(addProposalTx);

			ctx.syncAccounts();
			assert.deepEqual(
				ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "msg"),
				parsing.stringToBytes("my-message")
			);
		});
	});

	describe("Deposit Vote Token", function () {
		this.beforeAll(() => {
			setUpCtx();
			ctx.optInToDAOApp(ctx.proposalLsig.address()); // opt-in
			ctx.addProposal();

			ctx.optInToDAOApp(ctx.voterA.address);
			ctx.optInToDAOApp(ctx.voterB.address);
			ctx.syncAccounts();
		});

		const _depositVoteToken = (from, lsig, amount) => {
			const depositVoteTx = mkDepositVoteTokenTx(
				ctx.daoAppID,
				ctx.govTokenID,
				from,
				lsig,
				amount
			);
			ctx.executeTx(depositVoteTx);
			ctx.syncAccounts();
		};

		it("should accept token deposit", () => {
			const beforeBal = ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount;

			_depositVoteToken(ctx.voterA.account, 6);

			// verify local state
			assert.deepEqual(ctx.voterA.getLocalState(ctx.daoAppID, "deposit"), 6n);

			// verify deposit
			assert.deepEqual(ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount, beforeBal + 6n);
		});

		it("should accept multiple token deposit by same & different accounts", () => {
			const beforeBal = ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount;
			const initialADeposit = ctx.voterA.getLocalState(ctx.daoAppID, "deposit");

			// deposit 6 votes by A
			_depositVoteToken(ctx.voterA.account, 6);

			// verify local state & deposit
			assert.deepEqual(ctx.voterA.getLocalState(ctx.daoAppID, "deposit"), initialADeposit + 6n);
			assert.deepEqual(ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount, beforeBal + 6n);

			// deposit 4 votes by A again
			_depositVoteToken(ctx.voterA.account, 4);

			// verify local state & deposit
			assert.deepEqual(
				ctx.voterA.getLocalState(ctx.daoAppID, "deposit"),
				initialADeposit + 6n + 4n
			);
			assert.deepEqual(
				ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount,
				beforeBal + 6n + 4n
			);

			// deposit 5 votes by B
			_depositVoteToken(ctx.voterB.account, 5);

			// verify local state & deposit
			assert.deepEqual(ctx.voterB.getLocalState(ctx.daoAppID, "deposit"), 5n);
			assert.deepEqual(
				ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount,
				beforeBal + 6n + 4n + 5n
			);
		});

		it('should allow token deposit by any "from" account', () => {
			const beforeBal = ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount;
			const initialADeposit = ctx.voterA.getLocalState(ctx.daoAppID, "deposit");

			const depositVoteTx = mkDepositVoteTokenTx(
				ctx.daoAppID,
				ctx.govTokenID,
				ctx.voterA.account,
				5
			);

			// NOTE: tokens are transferred from proposer account, but recorded in voterA account
			depositVoteTx[1].fromAccount = ctx.proposer.account;

			ctx.executeTx(depositVoteTx);
			ctx.syncAccounts();

			// verify local state & deposit
			assert.deepEqual(ctx.voterA.getLocalState(ctx.daoAppID, "deposit"), initialADeposit + 5n);
			assert.deepEqual(ctx.depositAcc.getAssetHolding(ctx.govTokenID).amount, beforeBal + 5n);
		});
	});

	describe("Vote", function () {
		let registerVoteParam;
		this.beforeEach(() => {
			registerVoteParam = {
				type: types.TransactionType.CallApp,
				sign: types.SignType.SecretKey,
				fromAccount: ctx.voterA.account,
				appID: ctx.daoAppID,
				payFlags: { totalFee: 2000 },
				appArgs: ["str:register_vote", `str:${Vote.YES}`],
				accounts: [ctx.proposalLsig.address()],
			};

			// reset voterX's local state
			ctx.voterA.appsLocalState.delete(ctx.daoAppID);
			ctx.voterB.appsLocalState.delete(ctx.daoAppID);

			ctx.optInToDAOApp(ctx.voterA.address);
			ctx.optInToDAOApp(ctx.voterB.address);
			ctx.syncAccounts();

			// deposit votes (by A)
			ctx.depositVoteToken(ctx.voterA, 6);

			// deposit votes (by B)
			ctx.depositVoteToken(ctx.voterB, 4);

			// set "now" between [votingStart, votingEnd]
			ctx.runtime.setRoundAndTimestamp(
				10,
				votingStart + Math.round((votingEnd - votingStart) / 2)
			);
		});

		it("should allow voterA to register deposited tokens as votes", () => {
			ctx.executeTx(registerVoteParam);
			ctx.syncAccounts();

			// verify sender account has p_proposal set
			const key = new Uint8Array([
				...parsing.stringToBytes("p_"),
				...parsing.addressToPk(ctx.proposalLsig.address()),
			]);
			assert.isDefined(ctx.voterA.getLocalState(ctx.daoAppID, key));
			assert.equal(ctx.voterA.getLocalState(ctx.daoAppID, "deposit_lock"), votingEnd);

			// verify voting count
			assert.equal(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "yes"), 6n);
		});

		it("should allow voterB to register gov tokens as votes after voterA", () => {
			const yesVotes = ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "yes");
			const key = new Uint8Array([
				...parsing.stringToBytes("p_"),
				...parsing.addressToPk(ctx.proposalLsig.address()),
			]);

			// vote by A
			ctx.executeTx(registerVoteParam);
			ctx.syncAccounts();

			// verify sender state, and vote count
			assert.isDefined(ctx.voterA.getLocalState(ctx.daoAppID, key));
			assert.equal(ctx.voterA.getLocalState(ctx.daoAppID, "deposit_lock"), votingEnd);
			assert.equal(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "yes"), yesVotes + 6n);

			// vote by B
			ctx.executeTx({
				...registerVoteParam,
				fromAccount: ctx.voterB.account,
			});
			ctx.syncAccounts();

			// verify sender state, and vote count
			assert.isDefined(ctx.voterB.getLocalState(ctx.daoAppID, key));
			assert.equal(ctx.voterB.getLocalState(ctx.daoAppID, "deposit_lock"), votingEnd);
			assert.equal(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "yes"), yesVotes + 6n + 4n);
		});

		it("should allow voting if already set proposal_id is different", () => {
			// vote by A
			ctx.executeTx(registerVoteParam);
			ctx.syncAccounts();

			const key = new Uint8Array([
				...parsing.stringToBytes("p_"),
				...parsing.addressToPk(ctx.proposalLsig.address()),
			]);
			ctx.voterA.setLocalState(ctx.daoAppID, key, parsing.stringToBytes("some-new-id"));
			ctx.syncAccounts();

			// deposit vote again (PASSES, as we change p_proposal in sender local state)
			assert.doesNotThrow(() => ctx.executeTx(registerVoteParam));
		});
	});

	describe("Execute", function () {
		let executeProposalTx;
		this.beforeEach(() => {
			ctx.syncAccounts();
			executeProposalTx = [
				{
					type: types.TransactionType.CallApp,
					sign: types.SignType.SecretKey,
					fromAccount: ctx.proposer.account,
					appID: ctx.daoAppID,
					payFlags: { totalFee: 2000 }, // here we pay for both transactions
					appArgs: ["str:execute"],
					accounts: [ctx.proposalLsig.address()],
				},
				// tx1 as per proposal instructions
				{
					type: types.TransactionType.TransferAlgo,
					sign: types.SignType.LogicSignature,
					fromAccountAddr: ctx.daoFundLsig.address(),
					toAccountAddr: ctx.proposer.address,
					amountMicroAlgos: 2e6,
					lsig: ctx.daoFundLsig,
					payFlags: { totalFee: 0 }, // fee must be paid by proposer
				},
			];

			// reset proposalLsig state
			ctx.proposalLsigAcc.appsLocalState.delete(ctx.daoAppID);
			ctx.optInToDAOApp(ctx.proposalLsig.address());
			ctx.syncAccounts();
			ctx.addProposal();

			// reset voterX's local state
			ctx.voterA.appsLocalState.delete(ctx.daoAppID);
			ctx.voterB.appsLocalState.delete(ctx.daoAppID);

			ctx.optInToDAOApp(ctx.voterA.address);
			ctx.optInToDAOApp(ctx.voterB.address);
			ctx.syncAccounts();

			// deposit & register yes votes (by A)
			ctx.depositVoteToken(ctx.voterA, minSupport + 1);
			ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

			// deposit & register NO votes (by B)
			ctx.depositVoteToken(ctx.voterB, 2);
			ctx.vote(ctx.voterB, Vote.NO, ctx.proposalLsigAcc);

			// set current time after voting over
			ctx.runtime.setRoundAndTimestamp(10, votingEnd + 10);
		});

		it("should execute proposal for type == 1 (ALGO TRANSFER)", () => {
			const beforeProposerBal = ctx.proposer.balance();
			ctx.executeTx(executeProposalTx);
			ctx.syncAccounts();

			// verify executed is set to be true
			assert.equal(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "executed"), 1n);

			// verify payment recieved from dao fund
			assert.equal(ctx.proposer.balance(), beforeProposerBal + BigInt(2e6) - 2000n);
		});

		it("should execute proposal for type == 2 (ASA TRANSFER)", () => {
			const config = {
				type: BigInt(ProposalType.ASA_TRANSFER),
				from: parsing.addressToPk(ctx.daoFundLsig.address()),
				asa_id: BigInt(ctx.govTokenID),
				recipient: parsing.addressToPk(ctx.proposer.address),
				amount: 10n,
			};
			for (const [k, v] of Object.entries(config)) {
				ctx.proposalLsigAcc.setLocalState(ctx.daoAppID, k, v);
			}
			ctx.syncAccounts();

			const beforeProposerHolding = ctx.proposer.getAssetHolding(ctx.govTokenID).amount;
			executeProposalTx[1] = {
				type: types.TransactionType.TransferAsset,
				sign: types.SignType.LogicSignature,
				fromAccountAddr: ctx.daoFundLsig.address(),
				toAccountAddr: ctx.proposer.address,
				amount: config.amount,
				lsig: ctx.daoFundLsig,
				assetID: ctx.govTokenID,
				payFlags: { totalFee: 0 },
			};

			ctx.executeTx(executeProposalTx);
			ctx.syncAccounts();

			// verify executed is set to be true
			assert.equal(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "executed"), 1n);

			// verify gov tokens recieved
			assert.equal(
				ctx.proposer.getAssetHolding(ctx.govTokenID).amount,
				beforeProposerHolding + 10n
			);
		});

		it("should execute proposal for type == 3 (MESSAGE)", () => {
			const config = {
				type: BigInt(ProposalType.MESSAGE),
				msg: parsing.stringToBytes("my-message"),
			};

			const mp = ctx.proposalLsigAcc.appsLocalState.get(ctx.daoAppID)["key-value"];
			mp.delete(parsing.stringToBytes("from").join(","));

			for (const [k, v] of Object.entries(config)) {
				ctx.proposalLsigAcc.setLocalState(ctx.daoAppID, k, v);
			}

			ctx.syncAccounts();

			assert.doesNotThrow(() => ctx.executeTx([{ ...executeProposalTx[0] }]));
			ctx.syncAccounts();

			// verify executed is set to be true
			assert.equal(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "executed"), 1n);
		});

		it("should allow anyone to execute proposal", () => {
			executeProposalTx[0].fromAccount = ctx.voterA.account;

			assert.doesNotThrow(() => ctx.executeTx(executeProposalTx));
			ctx.syncAccounts();

			// verify executed is set to be true
			assert.equal(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, "executed"), 1n);
		});
	});

	describe("Withdraw Vote Deposit", function () {
		this.beforeAll(resetCtx);

		let withdrawVoteDepositTx;
		this.beforeEach(() => {
			withdrawVoteDepositTx = mkWithdrawVoteDepositTx(
				ctx.daoAppID,
				ctx.govTokenID,
				ctx.voterA.account,
				5
			);
		});

		it("should allow withdrawal after voting is over", () => {
			// set current time after voting over
			ctx.runtime.setRoundAndTimestamp(10, votingEnd + 10);
			ctx.syncAccounts();

			// before balance
			const beforeBalVoterA = ctx.voterA.getAssetHolding(ctx.govTokenID).amount;
			const beforeBalVoterB = ctx.voterB.getAssetHolding(ctx.govTokenID).amount;
			// before record of sender.deposit
			const beforeRecordVoterA = ctx.voterA.getLocalState(ctx.daoAppID, "deposit");
			const beforeRecordVoterB = ctx.voterB.getLocalState(ctx.daoAppID, "deposit");

			// withdrawal by A
			ctx.executeTx(
				mkWithdrawVoteDepositTx(ctx.daoAppID, ctx.govTokenID, ctx.voterA.account, 5)
			);
			ctx.syncAccounts();

			// withdrawal by B
			ctx.executeTx(
				mkWithdrawVoteDepositTx(ctx.daoAppID, ctx.govTokenID, ctx.voterB.account, 7)
			);
			ctx.syncAccounts();

			// verify sender.deposit
			assert.deepEqual(
				ctx.voterA.getLocalState(ctx.daoAppID, "deposit"),
				beforeRecordVoterA - 5n
			);
			assert.deepEqual(
				ctx.voterB.getLocalState(ctx.daoAppID, "deposit"),
				beforeRecordVoterB - 7n
			);

			// verify tokens received by voterA & voterB from depositLsig
			assert.deepEqual(ctx.voterA.getAssetHolding(ctx.govTokenID).amount, beforeBalVoterA + 5n);
			assert.deepEqual(ctx.voterB.getAssetHolding(ctx.govTokenID).amount, beforeBalVoterB + 7n);
		});
	});

	describe("Clear Vote Record", function () {
		this.beforeAll(resetCtx);

		it("should clear voting record if proposal is not active", () => {
			// set current time after voting over
			ctx.runtime.setRoundAndTimestamp(10, votingEnd + 10);

			// concatination of "p_" & proposalLsig.address
			const key = new Uint8Array([
				...parsing.stringToBytes("p_"),
				...parsing.addressToPk(ctx.proposalLsig.address()),
			]);

			// verify sender account has p_proposal set (before clear vote record)
			assert.isDefined(ctx.voterA.getLocalState(ctx.daoAppID, key));
			assert.isDefined(ctx.voterA.getLocalState(ctx.daoAppID, key));

			// clear voterA record
			const clearRecordVoterA = mkClearVoteRecordTx(
				ctx.daoAppID,
				ctx.voterA.account,
				ctx.proposalLsig.address()
			);
			ctx.executeTx(clearRecordVoterA);

			// clear voterB record
			const clearRecordVoterB = mkClearVoteRecordTx(
				ctx.daoAppID,
				ctx.voterB.account,
				ctx.proposalLsig.address()
			);
			ctx.executeTx(clearRecordVoterB);
			ctx.syncAccounts();

			// verify sender account has p_proposal removed after clear record
			assert.isUndefined(ctx.voterA.getLocalState(ctx.daoAppID, key));
			assert.isUndefined(ctx.voterA.getLocalState(ctx.daoAppID, key));
		});
	});

	describe("Close Proposal", function () {
		this.beforeAll(() => {
			// set up context
			setUpCtx();

			// optIn's
			ctx.optInToDAOApp(ctx.proposalLsig.address());
			ctx.optInToDAOApp(ctx.voterA.address);
			ctx.optInToDAOApp(ctx.voterB.address);
			ctx.optInToGovToken(ctx.proposalLsig.address());

			ctx.addProposal();
		});

		it("should close proposal if proposal is recorded & voting is not active", () => {
			// set current time after executeBefore
			ctx.runtime.setRoundAndTimestamp(10, executeBefore + 10);

			const closeProposalParam = mkCloseProposalTx(
				ctx.daoAppID,
				ctx.govTokenID,
				ctx.proposalLsig
			);
			ctx.executeTx(closeProposalParam);
			ctx.syncAccounts();

			// verify proposalLsig recieved back deposit of 15 tokens
			assert.equal(ctx.proposalLsigAcc.getAssetHolding(ctx.govTokenID).amount, BigInt(deposit));

			// verify proposal config is deleted from localstate
			for (const key of [
				"id",
				"name",
				"url",
				"url_hash",
				"hash_algo",
				"voting_start",
				"voting_end",
				"execute_before",
				"type",
				"from",
				"recipient",
				"amount",
				"yes",
				"no",
				"abstain",
			]) {
				assert.isUndefined(ctx.proposalLsigAcc.getLocalState(ctx.daoAppID, key));
			}
		});
	});
});
