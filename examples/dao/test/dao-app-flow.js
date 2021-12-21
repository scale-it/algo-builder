const { convert } = require('@algo-builder/algob');
const { Runtime, AccountStore } = require('@algo-builder/runtime');
const { types, parsing } = require('@algo-builder/web');
const { assert } = require('chai');
const { ProposalType, Vote, ExampleProposalConfig, DAOActions } = require('../scripts/run/common/common');
const {
  now, mkProposalTx, mkDepositVoteTokenTx, mkWithdrawVoteDepositTx,
  mkClearVoteRecordTx, mkClearProposalTx, votingStart, votingEnd, executeBefore
} = require('../scripts/run/common/tx-params');

const minBalance = 10e6; // 10 ALGO's
const initialBalance = 200e6;

/**
 * Test for scripts flow. Steps:
 * + create DAO (setup)
 *    1. Create Gov Token (ASA)
 *    2. Create DAO App
 *    3. Compile & fund lsig's (deposit, daoFund, proposal)
 *    4. Add depositLsig address to DAO app
 *    Note: Gov tokens are holded by proposerA, voterA, voterB
 * + add proposal
 * + deposit vote tokens
 * + register vote (by token holders voterA & voterB)
 * + execute proposal
 * + withdraw vote deposit
 * + clear vote record
 * + clear proposal
 * https://paper.dropbox.com/doc/Algo-DAO--BTR~tKj8P788NMZqnVfKwS7BAg-ncLdytuFa7EJrRerIASSl
 */
describe('DAO test', function () {
  const master = new AccountStore(1000e6);
  let creator = new AccountStore(initialBalance);
  let proposerA = new AccountStore(initialBalance);
  let proposerB = new AccountStore(initialBalance);
  let voterA = new AccountStore(initialBalance);
  let voterB = new AccountStore(initialBalance);
  let depositLsigAcc = new AccountStore(initialBalance); // runtime.account of depositLsig.address()
  let daoFundLsigAcc = new AccountStore(initialBalance);
  let proposalALsigAcc = new AccountStore(initialBalance);
  let proposalBLsigAcc = new AccountStore(initialBalance);

  let runtime;
  let appCreationFlags; // deploy app params (sender, storage schema)
  let appID; // DAO app
  let govTokenID;
  let depositLsig;
  let daoFundLsig;
  let proposalALsig;
  let proposalBLsig;

  this.beforeAll(async function () {
    runtime = new Runtime([
      master, creator, proposerA, proposerB, voterA, voterB,
      depositLsigAcc, daoFundLsigAcc, proposalALsigAcc, proposalBLsigAcc
    ]);

    appCreationFlags = {
      sender: creator.account,
      localInts: 9,
      localBytes: 7,
      globalInts: 4,
      globalBytes: 2
    };
  });

  const getGlobal = (key) => runtime.getGlobalState(appID, key);

  // fetch latest account state
  function syncAccounts () {
    creator = runtime.getAccount(creator.address);
    proposerA = runtime.getAccount(proposerA.address);
    proposerB = runtime.getAccount(proposerB.address);
    voterA = runtime.getAccount(voterA.address);
    voterB = runtime.getAccount(voterB.address);
    depositLsigAcc = runtime.getAccount(depositLsigAcc.address);
    daoFundLsigAcc = runtime.getAccount(daoFundLsigAcc.address);
    proposalALsigAcc = runtime.getAccount(proposalALsigAcc.address);
    proposalBLsigAcc = runtime.getAccount(proposalBLsigAcc.address);
  }

  // DAO App initialization parameters
  const deposit = 15; // deposit required to make a proposal
  const minSupport = 5; // minimum number of yes power votes to validate proposal
  const minDuration = 1 * 60; // 1min (minimum voting time in number of seconds)
  const maxDuration = 5 * 60; // 5min (maximum voting time in number of seconds)
  const url = 'www.my-url.com';

  function setUpDAO () {
    govTokenID = runtime.addAsset(
      'gov-token', { creator: { ...creator.account, name: 'dao-creator' } }).assetID;

    const daoAppArgs = [
      `int:${deposit}`,
      `int:${minSupport}`,
      `int:${minDuration}`,
      `int:${maxDuration}`,
      `str:${url}`
    ];

    const approvalFileName = 'dao-app-approval.py';
    const clearFilename = 'dao-app-clear.py';
    const placeholderParam = { ARG_GOV_TOKEN: govTokenID };
    // deploy application
    appID = runtime.deployApp(
      approvalFileName,
      clearFilename,
      { ...appCreationFlags, appArgs: daoAppArgs },
      {},
      placeholderParam
    ).appID;

    // setup lsig accounts
    // Initialize issuer lsig with bond-app ID
    const scInitParam = {
      ARG_GOV_TOKEN: govTokenID,
      ARG_DAO_APP_ID: appID
    };
    depositLsig = runtime.loadLogic('deposit-lsig.py', scInitParam);
    depositLsigAcc = runtime.getAccount(depositLsig.address());

    daoFundLsig = runtime.loadLogic('dao-fund-lsig.py', scInitParam);
    daoFundLsigAcc = runtime.getAccount(daoFundLsig.address());

    proposalALsig = runtime.loadLogic('proposal-lsig.py',
      { ARG_OWNER: proposerA.address, ARG_DAO_APP_ID: appID });
    proposalALsigAcc = runtime.getAccount(proposalALsig.address());

    proposalBLsig = runtime.loadLogic('proposal-lsig.py',
      { ARG_OWNER: proposerB.address, ARG_DAO_APP_ID: appID });
    proposalBLsigAcc = runtime.getAccount(proposalBLsig.address());

    // fund lsig's
    for (const lsig of [depositLsig, daoFundLsig, proposalALsig, proposalBLsig]) {
      runtime.fundLsig(master.account, lsig.address(), minBalance + 10000);
    }
    syncAccounts();

    // verify global state
    assert.isDefined(appID);
    assert.deepEqual(getGlobal('deposit'), BigInt(deposit));
    assert.deepEqual(getGlobal('min_support'), BigInt(minSupport));
    assert.deepEqual(getGlobal('min_duration'), BigInt(minDuration));
    assert.deepEqual(getGlobal('max_duration'), BigInt(maxDuration));
    assert.deepEqual(getGlobal('url'), parsing.stringToBytes(url));

    // add deposit_lsig address to DAO
    const addAccountsTx = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: creator.account,
      appID: appID,
      payFlags: {},
      appArgs: [
        'str:add_deposit_accounts',
        `addr:${depositLsig.address()}`
      ]
    };
    runtime.executeTx(addAccountsTx);

    // verify deposit_lsig address was added
    assert.deepEqual(getGlobal('deposit_lsig'), convert.addressToPk(depositLsig.address()));

    // optIn to ASA(Gov Token) by accounts
    for (const acc of [proposerA, proposerB, voterA, voterB, depositLsigAcc, daoFundLsigAcc]) {
      runtime.optIntoASA(govTokenID, acc.address, {});
    }
    syncAccounts();

    // verify optIn
    for (const acc of [proposerA, proposerB, voterA, voterB, depositLsigAcc, daoFundLsigAcc]) {
      assert.isDefined(acc.getAssetHolding(govTokenID));
    }

    // GOV Token distribution (used as initial fund)
    const distributeGovTokenParams = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creator.account,
      amount: 1000,
      assetID: govTokenID,
      payFlags: { totalFee: 1000 }
    };

    runtime.executeTx([
      { ...distributeGovTokenParams, toAccountAddr: proposerA.address },
      { ...distributeGovTokenParams, toAccountAddr: proposerB.address },
      { ...distributeGovTokenParams, toAccountAddr: voterA.address },
      { ...distributeGovTokenParams, toAccountAddr: voterB.address }
    ]);
    syncAccounts();

    assert.equal(proposerA.getAssetHolding(govTokenID).amount, 1000);
    assert.equal(proposerB.getAssetHolding(govTokenID).amount, 1000);
    assert.equal(voterA.getAssetHolding(govTokenID).amount, 1000);
    assert.equal(voterB.getAssetHolding(govTokenID).amount, 1000);
  }

  it('DAO flow test', () => {
    /**
    * Flow:
    *
    * Create Gov Token (ASA used to represent voting power)
    * Deploy DAO App
    * Compile & fund lsigs:
    *   a) depositLsig: holds "vote token deposits" & "Proposal deposits"
    *   b) proposalALsig: used by proposerA account for adding proposal
    *   c) daoFundLsig: represents DAO treasury
    * Save deposit lsig address in DAO app (only callable by creator)
    * Intial distribution of few gov token(s) to accounts (creator, proposerA, voters, lsigs)
    * Add proposal record in proposalALsig(as sender) + make deposit to deposit Lsig
    * Deposit vote tokens: voterA deposit 6 tokens, voterB deposits 8 tokens.
    * Voting (note: each token == 1 vote):
    *   a) move latest time after voting_now & <= voting_end
    *   b) voterA votes "yes" (== 6 votes)
    *   c) voterA votes "abstain" (== 8 votes).
    * Execute:
    *   a) move latest time after voting_end & <= execute_before
    *   b) Call to DAO app + Algo transfer tx (as per proposal instruction)
    * Withdrawing deposit:
    *   a) Call to DAO app + asset transfer (deposit_lsig => voter)
    *   b) voterA withdraws his 6 votes, voterB withdraws his 8 votes.
    * Clear Voting Record (by voterA & voterB)
    * Clear proposal:
    *   a) optIn to Gov Token by proposalALsig
    *   b) Call to DAO app by proposalALsig + asset transfer transaction from depositLsig -> proposalALsig
    */

    setUpDAO();

    /* --------------------  Add proposal  -------------------- */

    // optIn to DAO by proposalALsig
    runtime.optInToApp(proposalALsig.address(), appID, {}, {});

    let beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    const addProposalTx = mkProposalTx(
      appID,
      govTokenID,
      proposerA.account,
      depositLsig,
      proposalALsig,
      daoFundLsig
    );

    // set time (after now)
    runtime.setRoundAndTimestamp(5, now + 10);

    addProposalTx[1].amount = 15;
    runtime.executeTx(addProposalTx);
    syncAccounts();

    // assert proposal config is added
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'name'), parsing.stringToBytes(ExampleProposalConfig.name));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'url'), parsing.stringToBytes(ExampleProposalConfig.URL));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'url_hash'), parsing.stringToBytes(ExampleProposalConfig.URLHash));
    // empty hash_algo must save sha256
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'hash_algo'), parsing.stringToBytes('sha256'));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'voting_start'), BigInt(votingStart));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'voting_end'), BigInt(votingEnd));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'execute_before'), BigInt(executeBefore));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'type'), BigInt(ProposalType.ALGO_TRANSFER));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'from'), parsing.addressToPk(daoFundLsig.address()));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'recipient'), parsing.addressToPk(proposerA.address));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'amount'), BigInt(2e6));

    // verify deposit recieved in depositLsig
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 15n);

    /* --------------------  Deposit Vote Token  -------------------- */

    // optIn to DAO by voterA & voterB
    runtime.optInToApp(voterA.address, appID, {}, {});
    runtime.optInToApp(voterB.address, appID, {}, {});

    beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    // deposit 6 votes by voterA
    const depositVoteParamA = mkDepositVoteTokenTx(
      appID,
      govTokenID,
      voterA.account,
      depositLsig,
      6
    );
    runtime.executeTx(depositVoteParamA);

    const depositVoteParamB = mkDepositVoteTokenTx(
      appID,
      govTokenID,
      voterB.account,
      depositLsig,
      8
    );
    runtime.executeTx(depositVoteParamB);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(appID, 'deposit'), 6n);
    assert.deepEqual(voterB.getLocalState(appID, 'deposit'), 8n);

    // verify 7 + 8 votes deposited
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 6n + 8n);

    /* --------------------  Vote  -------------------- */
    runtime.setRoundAndTimestamp(10, Math.round((votingStart + votingEnd) / 2));

    // call to DAO app by voter (to register deposited votes)
    const registerVoteParam = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      appID: appID,
      payFlags: { totalFee: 2000 },
      accounts: [proposalALsig.address()]
    };

    // voting by user A
    const registerVoteA = {
      ...registerVoteParam,
      fromAccount: voterA.account,
      appArgs: [DAOActions.registerVote, `str:${Vote.YES}`]
    };
    runtime.executeTx(registerVoteA);

    // voting by user B
    const registerVoteB = {
      ...registerVoteParam,
      fromAccount: voterB.account,
      appArgs: [DAOActions.registerVote, `str:${Vote.ABSTAIN}`]
    };
    runtime.executeTx(registerVoteB);
    syncAccounts();

    // concatination of "p_" & proposalALsig.address
    const key = new Uint8Array([...parsing.stringToBytes('p_'), ...parsing.addressToPk(proposalALsig.address())]);

    // verify sender account has p_proposal set
    assert.isDefined(voterA.getLocalState(appID, key));
    assert.isDefined(voterB.getLocalState(appID, key));

    // verify voting count
    // + voterA registered 6 "yes" votes
    // + voterB registered 8 "abstain" votes
    assert.equal(proposalALsigAcc.getLocalState(appID, 'yes'), 6n);
    assert.equal(proposalALsigAcc.getLocalState(appID, 'abstain'), 8n);
    assert.isUndefined(proposalALsigAcc.getLocalState(appID, 'no')); // we didn't vote for "no"

    /* --------------------  Execute  -------------------- */

    runtime.setRoundAndTimestamp(15, now + (5 * 60));

    // verify proposal not executed before
    assert.equal(proposalALsigAcc.getLocalState(appID, 'executed'), 0n);

    const beforeProposerBal = proposerA.balance();
    const executeParams = [
      {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: proposerA.account,
        appID: appID,
        payFlags: { totalFee: 2000 },
        appArgs: [DAOActions.execute],
        accounts: [proposalALsig.address()]
      },
      // tx1 as per proposal instructions (set in ./add_proposal.js)
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: daoFundLsig.address(),
        toAccountAddr: proposerA.address,
        amountMicroAlgos: 2e6,
        lsig: daoFundLsig,
        payFlags: { totalFee: 0 } // fee must be paid by proposerA
      }
    ];
    runtime.executeTx(executeParams);
    syncAccounts();

    // verify executed is set to be true
    assert.equal(proposalALsigAcc.getLocalState(appID, 'executed'), 1n);

    // verify payment recieved from dao fund
    assert.equal(proposerA.balance(), beforeProposerBal + BigInt(2e6) - 2000n);

    /* --------------------  Withdraw Vote Deposit  -------------------- */

    // before balance
    const beforeBalVoterA = voterA.getAssetHolding(govTokenID).amount;
    const beforeBalVoterB = voterB.getAssetHolding(govTokenID).amount;
    // before record of sender.deposit
    const beforeRecordVoterA = voterA.getLocalState(appID, 'deposit');
    const beforeRecordVoterB = voterB.getLocalState(appID, 'deposit');

    // withdraw 6 votes deposited by voterA
    const withdrawVoteDepositA = mkWithdrawVoteDepositTx(
      appID,
      govTokenID,
      voterA.account,
      depositLsig,
      6
    );
    runtime.executeTx(withdrawVoteDepositA);

    // withdraw 8 votes deposited by voterB
    const withdrawVoteDepositB = mkWithdrawVoteDepositTx(
      appID,
      govTokenID,
      voterB.account,
      depositLsig,
      8
    );
    runtime.executeTx(withdrawVoteDepositB);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(appID, 'deposit'), beforeRecordVoterA - 6n);
    assert.deepEqual(voterB.getLocalState(appID, 'deposit'), beforeRecordVoterB - 8n);

    // verify tokens received by voterA & voterB from depositLsig
    assert.deepEqual(voterA.getAssetHolding(govTokenID).amount, beforeBalVoterA + 6n);
    assert.deepEqual(voterB.getAssetHolding(govTokenID).amount, beforeBalVoterB + 8n);

    /* --------------------  Clear Vote Record  -------------------- */

    // verify sender account has p_proposal set (before clear vote record)
    assert.isDefined(voterA.getLocalState(appID, key));
    assert.isDefined(voterA.getLocalState(appID, key));

    // clear voterA record
    const clearRecordVoterA = mkClearVoteRecordTx(
      appID,
      voterA.account,
      proposalALsig.address()
    );
    runtime.executeTx(clearRecordVoterA);

    // clear voterB record
    const clearRecordVoterB = mkClearVoteRecordTx(
      appID,
      voterB.account,
      proposalALsig.address()
    );
    runtime.executeTx(clearRecordVoterB);
    syncAccounts();

    // verify sender account has p_proposal removed after clear record
    assert.isUndefined(voterA.getLocalState(appID, key));
    assert.isUndefined(voterA.getLocalState(appID, key));

    /* --------------------  Clear Proposal  -------------------- */

    // optIn to GovToken by proposalALsig (protected by proposerA account using opt-in lock)
    const optInTx = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: proposerA.account,
        toAccountAddr: proposalALsig.address(),
        amountMicroAlgos: 0,
        payFlags: {}
      },
      {
        type: types.TransactionType.OptInASA,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: proposalALsig.address(),
        lsig: proposalALsig,
        assetID: govTokenID,
        payFlags: {}
      }
    ];
    runtime.executeTx(optInTx);
    syncAccounts();

    assert.isDefined(proposalALsigAcc.getAssetHolding(govTokenID));

    const clearProposalParam = mkClearProposalTx(
      appID,
      govTokenID,
      depositLsig,
      proposalALsig,
      15 // set as deposit in DAO App
    );
    runtime.executeTx(clearProposalParam);
    syncAccounts();

    // verify proposalALsig recieved back deposit of 15 tokens
    assert.equal(proposalALsigAcc.getAssetHolding(govTokenID).amount, 15n);

    // verify proposal config is deleted from localstate
    for (
      const key of ['name', 'url', 'url_hash', 'hash_algo', 'voting_start',
        'voting_end', 'execute_before', 'type', 'from', 'recipient',
        'amount', 'yes', 'no', 'abstain']
    ) {
      assert.isUndefined(proposalALsigAcc.getLocalState(appID, key));
    }
  });

  it('Should not allow to vote again with newly locked tokens', () => {
    /**
    * Flow:
    * + Setup DAO
    * + Add proposalA
    * + Lock 100 tokens by voterA (pass)
    * + Vote by voterA (pass)
    * + Lock 50 more tokens by voterA (pass)
    * + VoterA tries to voter again with newly locked tokens (fail)
    */

    setUpDAO();

    /* --------------------  Add proposal  -------------------- */

    // optIn to DAO by proposalALsig
    runtime.optInToApp(proposalALsig.address(), appID, {}, {});

    let beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    const addProposalTx = mkProposalTx(
      appID,
      govTokenID,
      proposerA.account,
      depositLsig,
      proposalALsig,
      daoFundLsig
    );

    // set time (after now)
    runtime.setRoundAndTimestamp(5, now + 10);

    addProposalTx[1].amount = 15;
    runtime.executeTx(addProposalTx);
    syncAccounts();

    // assert proposal config is added
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'name'), parsing.stringToBytes(ExampleProposalConfig.name));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'url'), parsing.stringToBytes(ExampleProposalConfig.URL));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'url_hash'), parsing.stringToBytes(ExampleProposalConfig.URLHash));
    // empty hash_algo must save sha256
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'hash_algo'), parsing.stringToBytes('sha256'));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'voting_start'), BigInt(votingStart));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'voting_end'), BigInt(votingEnd));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'execute_before'), BigInt(executeBefore));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'type'), BigInt(ProposalType.ALGO_TRANSFER));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'from'), parsing.addressToPk(daoFundLsig.address()));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'recipient'), parsing.addressToPk(proposerA.address));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'amount'), BigInt(2e6));

    // verify deposit recieved in depositLsig
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 15n);

    /* --------------------  Deposit Vote Token (Lock 100 tokens by A)  -------------------- */

    // optIn to DAO by voterA & voterB
    runtime.optInToApp(voterA.address, appID, {}, {});
    beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    // lock 100 votes by voterA
    const depositVoteParamA = mkDepositVoteTokenTx(
      appID,
      govTokenID,
      voterA.account,
      depositLsig,
      100
    );
    runtime.executeTx(depositVoteParamA);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(appID, 'deposit'), 100n);
    // verify 100 votes deposited
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 100n);

    /* --------------------  Register 100 Votes by A  -------------------- */
    runtime.setRoundAndTimestamp(10, Math.round((votingStart + votingEnd) / 2));

    // call to DAO app by voter (to register deposited votes)
    const registerVoteParam = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: voterA.account,
      appID: appID,
      payFlags: { totalFee: 2000 },
      appArgs: [DAOActions.registerVote, `str:${Vote.YES}`],
      accounts: [proposalALsig.address()]
    };
    runtime.executeTx(registerVoteParam);
    syncAccounts();

    // concatination of "p_" & proposalALsig.address
    const key = new Uint8Array([...parsing.stringToBytes('p_'), ...parsing.addressToPk(proposalALsig.address())]);

    // verify sender account has p_proposal set
    assert.isDefined(voterA.getLocalState(appID, key));

    // verify voting count
    assert.equal(proposalALsigAcc.getLocalState(appID, 'yes'), 100n);
    assert.isUndefined(proposalALsigAcc.getLocalState(appID, 'abstain')); // we didn't vote for "abstain"
    assert.isUndefined(proposalALsigAcc.getLocalState(appID, 'no')); // we didn't vote for "no"

    /* --------------------  Deposit Vote Token (Lock 50 tokens again by A)  -------------------- */
    beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    // lock 50 votes by voterA
    const depositVoteParam = mkDepositVoteTokenTx(
      appID,
      govTokenID,
      voterA.account,
      depositLsig,
      50
    );
    runtime.executeTx(depositVoteParam);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(appID, 'deposit'), 150n); // 100 + 50
    // verify 50 votes deposited
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 50n);

    /* --------------------  Register 50 Votes by A (fails this time)  -------------------- */
    assert.throws(
      () => runtime.executeTx(registerVoteParam),
      'RUNTIME_ERR1009: TEAL runtime encountered err opcode'
    );
  });

  it('Should allow to vote again with newly locked tokens for different proposal', () => {
    /**
    * Flow:
    * + Setup DAO
    * + Add proposalA
    * + Add proposalB
    * + Lock 50 tokens by voterA (pass)
    * + Vote by voterA (pass)
    * + Lock 50 more tokens by voterA (pass)
    * + VoterA tries to vote for proposalB (passes)
    */

    setUpDAO();

    /* --------------------  Add proposal(s)  -------------------- */

    // optIn to DAO by proposalALsig & proposalBLsig
    runtime.optInToApp(proposalALsig.address(), appID, {}, {});
    runtime.optInToApp(proposalBLsig.address(), appID, {}, {});

    let beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    const addProposalATx = mkProposalTx(
      appID,
      govTokenID,
      proposerA.account,
      depositLsig,
      proposalALsig,
      daoFundLsig
    );

    const addProposalBTx = mkProposalTx(
      appID,
      govTokenID,
      proposerB.account,
      depositLsig,
      proposalBLsig,
      daoFundLsig
    );

    // set time (after now)
    runtime.setRoundAndTimestamp(5, now + 10);

    addProposalATx[1].amount = 15;
    addProposalBTx[1].amount = 15;
    runtime.executeTx(addProposalATx);
    runtime.executeTx(addProposalBTx);

    syncAccounts();

    // verify deposit recieved in depositLsig
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 15n + 15n);

    /* --------------------  Deposit Vote Token (Lock 50 tokens by A)  -------------------- */

    // optIn to DAO by voterA & voterB
    runtime.optInToApp(voterA.address, appID, {}, {});
    beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    // lock 50 votes by voterA
    const depositVoteParamA = mkDepositVoteTokenTx(
      appID,
      govTokenID,
      voterA.account,
      depositLsig,
      50
    );
    runtime.executeTx(depositVoteParamA);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(appID, 'deposit'), 50n);
    // verify 50 votes deposited
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 50n);

    /* --------------------  Register 50 Votes by A  -------------------- */
    runtime.setRoundAndTimestamp(10, Math.round((votingStart + votingEnd) / 2));

    // call to DAO app by voter (to register deposited votes)
    const registerVoteParam = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: voterA.account,
      appID: appID,
      payFlags: { totalFee: 2000 },
      appArgs: [DAOActions.registerVote, `str:${Vote.ABSTAIN}`],
      accounts: [proposalALsig.address()]
    };
    runtime.executeTx(registerVoteParam);
    syncAccounts();

    // concatination of "p_" & proposalALsig.address
    const key = new Uint8Array([...parsing.stringToBytes('p_'), ...parsing.addressToPk(proposalALsig.address())]);

    // verify sender account has p_proposal set
    assert.isDefined(voterA.getLocalState(appID, key));

    // verify voting count
    assert.equal(proposalALsigAcc.getLocalState(appID, 'abstain'), 50n);
    assert.isUndefined(proposalALsigAcc.getLocalState(appID, 'yes')); // we didn't vote for "yes"
    assert.isUndefined(proposalALsigAcc.getLocalState(appID, 'no')); // we didn't vote for "no"

    /* --------------------  Deposit Vote Token (Lock 50 tokens again by A)  -------------------- */
    beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    // lock 50 votes by voterA
    const depositVoteParam = mkDepositVoteTokenTx(
      appID,
      govTokenID,
      voterA.account,
      depositLsig,
      50
    );
    runtime.executeTx(depositVoteParam);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(appID, 'deposit'), 100n); // 50 + 50
    // verify 50 votes deposited
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 50n);

    /* --------------------  Register 100 Votes by A for proposalB (passes this time)  -------------------- */
    // call to DAO app by voter (to register deposited votes)
    const registerVoteParamForProposalB = {
      ...registerVoteParam,
      accounts: [proposalBLsig.address()]
    };
    runtime.executeTx(registerVoteParamForProposalB);
    syncAccounts();

    // concatination of "p_" & proposalBLsig.address
    const proposalBKey = new Uint8Array([...parsing.stringToBytes('p_'), ...parsing.addressToPk(proposalBLsig.address())]);

    // verify sender account has p_proposal set
    assert.isDefined(voterA.getLocalState(appID, proposalBKey));

    // verify voting count
    assert.equal(proposalBLsigAcc.getLocalState(appID, 'abstain'), 100n);
    assert.isUndefined(proposalBLsigAcc.getLocalState(appID, 'yes')); // we didn't vote for "yes"
    assert.isUndefined(proposalBLsigAcc.getLocalState(appID, 'no')); // we didn't vote for "no"
  });

  it('Should allow to clear proposal if it is passsed execution', () => {
    /**
    * Flow:
    * + Setup DAO
    * + Add proposalA
    * + Clear proposalA (passes if past execution)
    */
    setUpDAO();

    /* --------------------  Add proposal  -------------------- */

    // optIn to DAO by proposalALsig
    runtime.optInToApp(proposalALsig.address(), appID, {}, {});

    const beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    const addProposalTx = mkProposalTx(
      appID,
      govTokenID,
      proposerA.account,
      depositLsig,
      proposalALsig,
      daoFundLsig
    );

    // set time (after now)
    runtime.setRoundAndTimestamp(5, now + 10);

    addProposalTx[1].amount = 15;
    runtime.executeTx(addProposalTx);
    syncAccounts();

    // assert proposal config is added
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'name'), parsing.stringToBytes(ExampleProposalConfig.name));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'url'), parsing.stringToBytes(ExampleProposalConfig.URL));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'url_hash'), parsing.stringToBytes(ExampleProposalConfig.URLHash));
    // empty hash_algo must save sha256
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'hash_algo'), parsing.stringToBytes('sha256'));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'voting_start'), BigInt(votingStart));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'voting_end'), BigInt(votingEnd));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'execute_before'), BigInt(executeBefore));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'type'), BigInt(ProposalType.ALGO_TRANSFER));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'from'), parsing.addressToPk(daoFundLsig.address()));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'recipient'), parsing.addressToPk(proposerA.address));
    assert.deepEqual(proposalALsigAcc.getLocalState(appID, 'amount'), BigInt(2e6));

    // verify deposit recieved in depositLsig
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 15n);

    /* --------------------  Clear Proposal  -------------------- */
    // set time past executeBefore
    runtime.setRoundAndTimestamp(5, executeBefore + 10);

    // optIn to GovToken by proposalALsig (protected by proposerA account using opt-in lock)
    const optInTx = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: proposerA.account,
        toAccountAddr: proposalALsig.address(),
        amountMicroAlgos: 0,
        payFlags: {}
      },
      {
        type: types.TransactionType.OptInASA,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: proposalALsig.address(),
        lsig: proposalALsig,
        assetID: govTokenID,
        payFlags: {}
      }
    ];
    runtime.executeTx(optInTx);
    syncAccounts();

    assert.isDefined(proposalALsigAcc.getAssetHolding(govTokenID));

    const clearProposalParam = mkClearProposalTx(
      appID,
      govTokenID,
      depositLsig,
      proposalALsig,
      15 // set as deposit in DAO App
    );
    runtime.executeTx(clearProposalParam);
    syncAccounts();

    // verify proposalALsig recieved back deposit of 15 tokens
    assert.equal(proposalALsigAcc.getAssetHolding(govTokenID).amount, 15n);

    // verify proposal config is deleted from localstate
    for (
      const key of ['name', 'url', 'url_hash', 'hash_algo', 'voting_start',
        'voting_end', 'execute_before', 'type', 'from', 'recipient',
        'amount', 'yes', 'no', 'abstain']
    ) {
      assert.isUndefined(proposalALsigAcc.getLocalState(appID, key));
    }
  });
});
