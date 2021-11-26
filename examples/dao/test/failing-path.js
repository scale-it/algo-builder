const { AccountStore } = require('@algo-builder/runtime');
const { types } = require('@algo-builder/web');
const { assert } = require('chai');
const { Context, initialBalance, minSupport, deposit } = require('./common');
const { ProposalType, Vote } = require('../scripts/run/common/common');
const { mkProposalTx, mkDepositVoteTokenTx, votingStart, votingEnd, executeBefore, mkWithdrawVoteDepositTx, mkClearVoteRecordTx, mkClearProposalTx } = require('../scripts/run/common/tx-params');

const now = Math.round(new Date().getTime() / 1000);

const RUNTIME_ERR1009 = 'RUNTIME_ERR1009: TEAL runtime encountered err opcode';
const INDEX_OUT_OF_BOUND_ERR = 'RUNTIME_ERR1008: Index out of bound';
const INTEGER_UNDERFLOW_ERR = 'Result of current operation caused integer underflow';
const APP_NOT_FOUND = 'RUNTIME_ERR1306: Application Index 9 not found or is invalid';

describe('DAO - Failing Paths', function () {
  let master, creator, proposer, voterA, voterB;
  let depositLsigAcc, daoFundLsigAcc, proposalLsigAcc;
  let ctx;

  function setUpCtx () {
    master = new AccountStore(1000e6);
    creator = new AccountStore(initialBalance);
    proposer = new AccountStore(initialBalance);
    voterA = new AccountStore(initialBalance);
    voterB = new AccountStore(initialBalance);
    depositLsigAcc = new AccountStore(initialBalance); // runtime.account of depositLsig.address()
    daoFundLsigAcc = new AccountStore(initialBalance);
    proposalLsigAcc = new AccountStore(initialBalance);

    ctx = new Context(
      master, creator, proposer, voterA, voterB,
      depositLsigAcc, daoFundLsigAcc, proposalLsigAcc
    );
  }

  describe('SetUp', function () {
    this.beforeAll(setUpCtx);

    it('should reject set_deposit in DAO if sender !== creator', () => {
      // add deposit_lsig address to DAO
      const addAccountsTx = {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: ctx.voterA.account,
        appID: ctx.daoAppID,
        payFlags: {},
        appArgs: [
          'str:add_deposit_accounts',
          `addr:${ctx.depositLsig.address()}`
        ]
      };

      assert.throws(() => ctx.executeTx(addAccountsTx), RUNTIME_ERR1009);
    });
  });

  describe('Add proposal', function () {
    this.beforeAll(setUpCtx);

    let proposalParams, addProposalTx;
    this.beforeEach(() => {
      proposalParams = [
        'str:add_proposal',
        'str:my-custom-proposal', // name
        'str:www.myurl.com', // url
        'str:url-hash', // url_hash
        'str:', // hash_algo (passing null)
        `int:${votingStart}`, // votingStart (now + 1min)
        `int:${votingEnd}`, // votingEnd (now + 3min)
        `int:${executeBefore}`, // executeBefore (now + 7min)
        `int:${ProposalType.ALGO_TRANSFER}`, // type
        `addr:${ctx.daoFundLsig.address()}`, // from (DAO treasury)
        `addr:${ctx.proposer.address}`, // recepient
        `int:${2e6}` // amount (in microalgos)
      ];

      addProposalTx = mkProposalTx(
        ctx.daoAppID,
        ctx.govTokenID,
        ctx.proposer.account,
        ctx.depositLsig,
        ctx.proposalLsig,
        ctx.daoFundLsig
      );
      // update transfer amount of proposal deposit tx
      addProposalTx[1].amount = 15;
    });

    it('should fail if proposalLsig not opted-in to DAO App', () => {
      assert.throws(() => ctx.executeTx(addProposalTx), APP_NOT_FOUND);
    });

    it('should fail if votingEnd < votingStart', () => {
      ctx.optInToDAOApp(ctx.proposalLsig.address()); // opt-in
      ctx.syncAccounts();

      // set votingEnd < votingStart (30s before)
      proposalParams[6] = `int:${votingStart - 30}`;
      addProposalTx[0].appArgs = proposalParams;

      assert.throws(() => ctx.executeTx(addProposalTx), INTEGER_UNDERFLOW_ERR);
    });

    it('should fail if "min_duration <= votingEnd - votingStart <= max_duration" is not satisfied', () => {
      // increase votingEnd (voting duration set as 9min, but allowed is 5min)
      proposalParams[6] = `int:${votingEnd + (10 * 60)}`;
      addProposalTx[0].appArgs = proposalParams;

      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);
    });

    it('should fail if executeBefore <= votingEnd', () => {
      // set executeBefore < votingEnd
      proposalParams[7] = `int:${votingEnd - 30}`;
      addProposalTx[0].appArgs = proposalParams;
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);

      // set executeBefore == votingEnd
      proposalParams[7] = `int:${votingEnd}`;
      addProposalTx[0].appArgs = proposalParams;
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);
    });

    it('should fail if proposal type is not between [1-3]', () => {
      proposalParams[8] = 'int:4';
      addProposalTx[0].appArgs = proposalParams;
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);

      proposalParams[8] = 'int:0';
      addProposalTx[0].appArgs = proposalParams;
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);
    });

    it('should fail if gov tokens deposit transaction is not present', () => {
      assert.throws(() => ctx.executeTx({ ...addProposalTx[0] }), INDEX_OUT_OF_BOUND_ERR);
    });

    it('should fail if gov tokens deposit is not equal to DAO.deposit', () => {
      addProposalTx[1].amount = deposit - 1;
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);

      addProposalTx[1].amount = deposit + 1;
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);
    });

    it('should fail if deposit lsig address is different', () => {
      addProposalTx[1].toAccountAddr = ctx.proposer.address;
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);
    });

    it('should fail if votingStart <= now', () => {
      ctx.runtime.setRoundAndTimestamp(1, votingStart + 10); // now > votingStart
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);

      ctx.runtime.setRoundAndTimestamp(1, votingStart); // now == votingStart
      assert.throws(() => ctx.executeTx(addProposalTx), RUNTIME_ERR1009);
    });
  });

  describe('Deposit Vote Token', function () {
    this.beforeAll(() => {
      ctx.addProposal();
    });

    const _depositVoteToken = (from, lsig, amount) => {
      const depositVoteTx = mkDepositVoteTokenTx(
        ctx.daoAppID, ctx.govTokenID, from, lsig, amount
      );
      ctx.executeTx(depositVoteTx);
    };

    it('should fail if voterAccount is not optedIn to DAO App', () => {
      assert.throws(
        () => _depositVoteToken(ctx.voterA.account, ctx.depositLsig, 6),
        APP_NOT_FOUND
      );
    });

    it('should fail if gov tokens deposit transaction is not present', () => {
      ctx.optInToDAOApp(ctx.voterA.address);
      ctx.optInToDAOApp(ctx.voterB.address);
      ctx.syncAccounts();

      const txParams = mkDepositVoteTokenTx(
        ctx.daoAppID,
        ctx.govTokenID,
        ctx.voterA.account,
        ctx.depositLsig,
        6
      );
      assert.throws(
        () => ctx.executeTx({ ...txParams[0] }),
        INDEX_OUT_OF_BOUND_ERR
      );
    });

    it('should fail if receiver is not depositLsig', () => {
      assert.throws(
        () => _depositVoteToken(ctx.voterA.account, ctx.daoFundLsig, 6),
        RUNTIME_ERR1009
      );
    });
  });

  describe('Vote', function () {
    let registerVoteParam;
    this.beforeEach(() => {
      registerVoteParam = {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: ctx.voterA.account,
        appID: ctx.daoAppID,
        payFlags: { totalFee: 2000 },
        appArgs: ['str:register_vote', `str:${Vote.YES}`],
        accounts: [ctx.proposalLsig.address()]
      };

      // set "now" between [votingStart, votingEnd]
      ctx.runtime.setRoundAndTimestamp(10, votingStart + Math.round((votingEnd - votingStart) / 2));
    });

    it('should fail if proposalLsig address is not passed', () => {
      assert.throws(
        () =>
          ctx.executeTx({
            ...registerVoteParam,
            accounts: [ctx.depositLsig.address()] // different address passed
          }),
        RUNTIME_ERR1009
      );
    });

    it('should fail if no gov tokens are deposited', () => {
      // voterB hasn't deposited gov tokens yet
      assert.throws(
        () => ctx.executeTx({ ...registerVoteParam, fromAccount: ctx.voterB.account }),
        RUNTIME_ERR1009
      );
    });

    it('should fail if a user votes again for the same proposal (double voting)', () => {
      // user deposits gov tokens for voting (OK)
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, 6);

      // user votes (OK)
      ctx.executeTx({ ...registerVoteParam, fromAccount: ctx.voterA.account });

      // user deposits again (OK)
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, 4);

      // user tries to vote again after depositing more tokens (FAIL)
      assert.throws(
        () => ctx.executeTx({ ...registerVoteParam, fromAccount: ctx.voterA.account }),
        RUNTIME_ERR1009
      );
    });

    it('should fail if latest_timestamp is < votingStart (i.e voting is not open)', () => {
      // set now < votingStart
      ctx.runtime.setRoundAndTimestamp(10, now + 30);

      // deposit votes by voterB
      ctx.depositVoteToken(ctx.voterB, ctx.depositLsig, 8);

      assert.throws(
        () => ctx.executeTx({ ...registerVoteParam, fromAccount: ctx.voterB.account }),
        RUNTIME_ERR1009
      );
    });
  });

  describe('Execute', function () {
    function resetCtx () {
      // set up context
      setUpCtx();

      // optIn's
      ctx.optInToDAOApp(ctx.proposalLsig.address());
      ctx.optInToDAOApp(ctx.voterA.address);
      ctx.optInToDAOApp(ctx.voterB.address);

      // add proposal
      ctx.addProposal();
    }

    this.beforeEach(resetCtx);

    let executeProposalTx;
    this.beforeEach(() => {
      executeProposalTx = [
        {
          type: types.TransactionType.CallApp,
          sign: types.SignType.SecretKey,
          fromAccount: ctx.proposer.account,
          appID: ctx.daoAppID,
          payFlags: { totalFee: 2000 }, // here we pay for both transactions
          appArgs: ['str:execute'],
          accounts: [ctx.proposalLsig.address()]
        },
        // tx1 as per proposal instructions
        {
          type: types.TransactionType.TransferAlgo,
          sign: types.SignType.LogicSignature,
          fromAccountAddr: ctx.daoFundLsig.address(),
          toAccountAddr: ctx.proposer.address,
          amountMicroAlgos: 2e6,
          lsig: ctx.daoFundLsig,
          payFlags: { totalFee: 0 } // fee must be paid by proposer
        }
      ];

      // set current time after voting over
      ctx.runtime.setRoundAndTimestamp(10, votingEnd + 10);
    });

    it('should reject execute if proposal is expired', () => {
      // set current time as > executeBefore
      ctx.runtime.setRoundAndTimestamp(10, executeBefore + 30);
      assert.throws(
        () => ctx.executeTx(executeProposalTx),
        RUNTIME_ERR1009
      );
    });

    it('execution should fail if now < votingStart (before voting started)', () => {
      // set current time as > executeBefore
      ctx.runtime.setRoundAndTimestamp(10, votingStart - 30);
      assert.throws(
        () => ctx.executeTx(executeProposalTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject execute if voting is still in progress', () => {
      // set current time when "voting is active"
      ctx.runtime.setRoundAndTimestamp(10, votingStart + 30);
      assert.throws(
        () => ctx.executeTx(executeProposalTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject execution if proposal.yes < min_support', () => {
      // register votes by A (< min_support)
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, minSupport - 1);
      ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

      assert.throws(
        () => ctx.executeTx(executeProposalTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject execution if proposal.yes > min_support, but vote.no > vote.yes', () => {
      // register 2 more votes by A (> min_support)
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, minSupport + 1);
      ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

      // register votes by voterB (where NO votes > YES votes by voterA)
      ctx.depositVoteToken(ctx.voterB, ctx.depositLsig, minSupport + 5);
      ctx.vote(ctx.voterB, Vote.NO, ctx.proposalLsigAcc);

      assert.throws(
        () => ctx.executeTx(executeProposalTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject execution if proposal already executed', () => {
      // register yes votes
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, minSupport + 1);
      ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

      // set executed == true
      ctx.proposalLsigAcc.setLocalState(ctx.daoAppID, 'executed', 1n);

      assert.throws(
        () => ctx.executeTx(executeProposalTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject execution if 2nd transaction not included', () => {
      // register yes votes
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, minSupport + 1);
      ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

      assert.throws(
        () => ctx.executeTx({ ...executeProposalTx[0] }),
        INDEX_OUT_OF_BOUND_ERR
      );
    });

    it('should reject execution if 2nd transaction is not per proposal instructions', () => {
      // register yes votes
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, minSupport + 1);
      ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

      // amount is wrong
      assert.throws(
        () => ctx.executeTx([
          { ...executeProposalTx[0] },
          { ...executeProposalTx[1], amountMicroAlgos: 10n }
        ]),
        RUNTIME_ERR1009
      );

      // recipient is wrong
      assert.throws(
        () => ctx.executeTx([
          { ...executeProposalTx[0] },
          { ...executeProposalTx[1], toAccountAddr: ctx.voterA.address }
        ]),
        RUNTIME_ERR1009
      );

      // from_account is wrong (for tx1)
      // for tx0, from_account can be any account
      // NOTE: Here we change the "from account" of transaction as per proposal instructions (tx1).
      // And should fail if from account address is different from the one recorded in original proposal
      assert.throws(
        () => ctx.executeTx([
          { ...executeProposalTx[0] },
          { ...executeProposalTx[1], fromAccountAddr: ctx.voterA.address }
        ]),
        RUNTIME_ERR1009
      );
    });
  });

  describe('Withdraw Vote Deposit', function () {
    this.beforeAll(() => {
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
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, minSupport + 1);
      ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);

      // deposit & register yes votes (by B)
      ctx.depositVoteToken(ctx.voterB, ctx.depositLsig, minSupport + 1);
      ctx.vote(ctx.voterB, Vote.YES, ctx.proposalLsigAcc);

      // execute proposal
      ctx.executeProposal(ctx.proposalLsigAcc);
    });

    let withdrawVoteDepositTx;
    this.beforeEach(() => {
      withdrawVoteDepositTx = mkWithdrawVoteDepositTx(
        ctx.daoAppID, ctx.govTokenID, ctx.voterA.account, ctx.depositLsig, 5
      );

      // set current time after voting over
      ctx.runtime.setRoundAndTimestamp(10, votingEnd + 10);
    });

    it('should reject withdrawal if voting is active', () => {
      // set current time between [votingStart, votingEnd]
      ctx.runtime.setRoundAndTimestamp(10, votingStart + Math.round((votingEnd - votingStart) / 2));

      assert.throws(
        () => ctx.executeTx(withdrawVoteDepositTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject withdrawal if fees is not paid by tx0', () => {
      assert.throws(
        () => ctx.executeTx([
          { ...withdrawVoteDepositTx[0] },
          { ...withdrawVoteDepositTx[1], payFlags: { totalFee: 1000 } }
        ]),
        RUNTIME_ERR1009
      );
    });

    it('should reject withdrawal if 2nd transaction not included', () => {
      assert.throws(
        () => ctx.executeTx({ ...withdrawVoteDepositTx[0] }),
        INDEX_OUT_OF_BOUND_ERR
      );
    });

    it('should reject withdrawal trying to withdraw more than deposited', () => {
      const origDeposit = ctx.voterA.getLocalState(ctx.daoAppID, 'deposit');
      assert.throws(
        () => ctx.executeTx([
          { ...withdrawVoteDepositTx[0] },
          { ...withdrawVoteDepositTx[1], amount: origDeposit + 5n }
        ]),
        INTEGER_UNDERFLOW_ERR // -ve value handled by TEAL
      );
    });

    it('should allow partial withdrawals', () => {
      const origDeposit = ctx.voterA.getLocalState(ctx.daoAppID, 'deposit');
      // we use voterB for withdrawal here
      withdrawVoteDepositTx = mkWithdrawVoteDepositTx(
        ctx.daoAppID, ctx.govTokenID, ctx.voterB.account, ctx.depositLsig, 5
      );

      // withdraw 1 gov token
      ctx.executeTx([
        { ...withdrawVoteDepositTx[0] },
        { ...withdrawVoteDepositTx[1], amount: 1n }
      ]);

      // withdraw (origDeposit - 1) gov tokens (PASSES)
      ctx.executeTx([
        { ...withdrawVoteDepositTx[0] },
        { ...withdrawVoteDepositTx[1], amount: origDeposit - 1n }
      ]);
    });

    it('should reject on overflow in partial withdrawals', () => {
      const origDeposit = ctx.voterA.getLocalState(ctx.daoAppID, 'deposit');

      // withdraw 1 gov token
      ctx.executeTx([
        { ...withdrawVoteDepositTx[0] },
        { ...withdrawVoteDepositTx[1], amount: 2n }
      ]);

      // trying to withdraw (origDeposit - 1) gov tokens (FAILS, as total amount exceeds origDeposit)
      assert.throws(
        () => ctx.executeTx([
          { ...withdrawVoteDepositTx[0] },
          { ...withdrawVoteDepositTx[1], amount: origDeposit - 1n }
        ]),
        INTEGER_UNDERFLOW_ERR // -ve value handled by TEAL
      );
    });
  });

  describe('Clear Vote Record', function () {
    this.beforeAll(() => {
      // set up context
      setUpCtx();

      // optIn's
      ctx.optInToDAOApp(ctx.proposalLsig.address());
      ctx.optInToDAOApp(ctx.voterA.address);
      ctx.optInToDAOApp(ctx.voterB.address);
      ctx.syncAccounts();

      // add proposal
      ctx.addProposal();

      // deposit & register yes votes
      ctx.depositVoteToken(ctx.voterA, ctx.depositLsig, minSupport + 1);
      ctx.vote(ctx.voterA, Vote.YES, ctx.proposalLsigAcc);
    });

    let clearVoteRecordTx;
    this.beforeEach(() => {
      clearVoteRecordTx = mkClearVoteRecordTx(
        ctx.daoAppID, ctx.voterA.account, ctx.proposalLsig.address()
      );
    });

    it('should reject clear voting record if proposal is active(passed but not executed)', () => {
      // set current time after voting over
      ctx.runtime.setRoundAndTimestamp(10, votingEnd + 10);

      assert.throws(
        () => ctx.executeTx(clearVoteRecordTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject clear voting record if propsal is active(still in voting)', () => {
      // set current time between [votingStart, votingEnd]
      ctx.runtime.setRoundAndTimestamp(10, votingStart + Math.round((votingEnd - votingStart) / 2));

      // Note: we register enough YES votes in beforeAll, so it will pass,
      // but proposal is not executed as it is still in voting
      assert.throws(
        () => ctx.executeTx(clearVoteRecordTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject tx if groupSize !== 1', () => {
      assert.throws(
        () => ctx.executeTx([
          { ...clearVoteRecordTx }, { ...clearVoteRecordTx }
        ]),
        RUNTIME_ERR1009
      );
    });
  });

  describe('Clear Proposal', function () {
    this.beforeAll(() => {
      // set up context
      setUpCtx();

      // optIn's
      ctx.optInToDAOApp(ctx.proposalLsig.address());
      ctx.optInToDAOApp(ctx.voterA.address);
      ctx.optInToDAOApp(ctx.voterB.address);
      ctx.optInToGovToken(ctx.proposalLsig.address());

      // set current time after executeBefore
      ctx.runtime.setRoundAndTimestamp(10, executeBefore + 10);
    });

    let clearProposalTx;
    this.beforeEach(() => {
      clearProposalTx = mkClearProposalTx(
        ctx.daoAppID,
        ctx.govTokenID,
        ctx.depositLsig,
        ctx.proposalLsig,
        deposit
      );
    });

    it('should reject clear_proposal if proposal is not recorded in lsig', () => {
      assert.throws(
        () => ctx.executeTx(clearProposalTx),
        RUNTIME_ERR1009
      );
    });

    it('should reject clear_proposal if deposit amount is invalid', () => {
      ctx.addProposal();

      assert.throws(
        () => ctx.executeTx([
          { ...clearProposalTx[0] },
          { ...clearProposalTx[1], amount: deposit - 5 }
        ]),
        RUNTIME_ERR1009
      );
    });

    it('should reject clear_proposal if sender of tx0 is not receiver of govTokens in tx1', () => {
      assert.throws(
        () => ctx.executeTx([
          { ...clearProposalTx[0] },
          { ...clearProposalTx[1], toAccountAddr: ctx.daoFundLsig.address() }
        ]),
        RUNTIME_ERR1009
      );
    });

    it('should reject clear_proposal if tx1(asset_transfer).fee !== 0', () => {
      assert.throws(
        () => ctx.executeTx([
          { ...clearProposalTx[0] },
          { ...clearProposalTx[1], payFlags: { totalFee: 1000 } }
        ]),
        RUNTIME_ERR1009
      );
    });

    it('should reject clear_proposal if voting is active', () => {
      // set current time between [votingStart, votingEnd]
      ctx.runtime.setRoundAndTimestamp(10, votingStart + Math.round((votingEnd - votingStart) / 2));

      assert.throws(
        () => ctx.executeTx(clearProposalTx),
        RUNTIME_ERR1009
      );
    });
  });
});
