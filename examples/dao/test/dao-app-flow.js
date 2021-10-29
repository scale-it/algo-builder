const { getProgram, convert } = require('@algo-builder/algob');
const { Runtime, AccountStore } = require('@algo-builder/runtime');
const { types, parsing } = require('@algo-builder/web');
const { assert } = require('chai');
const { ProposalType, Vote } = require('../scripts/run/common/common');
const {
  now, mkProposalTx, mkDepositVoteTokenTx, mkWithdrawVoteDepositTx,
  mkClearVoteRecordTx, mkClearProposalTx
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
 *    Note: Gov tokens are holded by proposer, voterA, voterB
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
  let proposer = new AccountStore(initialBalance);
  let voterA = new AccountStore(initialBalance);
  let voterB = new AccountStore(initialBalance);
  let depositLsigAcc = new AccountStore(initialBalance); // runtime.account of depositLsig.address()
  let daoFundLsigAcc = new AccountStore(initialBalance);
  let proposalLsigAcc = new AccountStore(initialBalance);

  let runtime;
  let appCreationFlags; // deploy app params (sender, storage schema)
  let appID; // DAO app
  let govTokenID;
  let depositLsig;
  let daoFundLsig;
  let proposalLsig;

  this.beforeAll(async function () {
    runtime = new Runtime([
      master, creator, proposer, voterA, voterB,
      depositLsigAcc, daoFundLsigAcc, proposalLsigAcc
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
    proposer = runtime.getAccount(proposer.address);
    voterA = runtime.getAccount(voterA.address);
    voterB = runtime.getAccount(voterB.address);
    depositLsigAcc = runtime.getAccount(depositLsigAcc.address);
    daoFundLsigAcc = runtime.getAccount(daoFundLsigAcc.address);
    proposalLsigAcc = runtime.getAccount(proposalLsigAcc.address);
  }

  // DAO App initialization parameters
  const deposit = 15; // deposit required to make a proposal
  const minSupport = 5; // minimum number of yes power votes to validate proposal
  const minDuration = 1 * 60; // 1min (minimum voting time in number of seconds)
  const maxDuration = 5 * 60; // 5min (maximum voting time in number of seconds)
  const url = 'www.my-url.com';

  it('DAO flow test', () => {
    /**
    * Flow:
    *
    * Create Gov Token (ASA used to represent voting power)
    * Deploy DAO App
    * Compile & fund lsigs:
    *   a) depositLsig: holds "vote token deposits" & "Proposal deposits"
    *   b) proposalLsig: used by proposer account for adding proposal
    *   c) daoFundLsig: represents DAO treasury
    * Save deposit lsig address in DAO app (only callable by creator)
    * Intial distribution of few gov token(s) to accounts (creator, proposer, voters, lsigs)
    * Add proposal record in proposalLsig(as sender) + make deposit to deposit Lsig
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
    *   a) optIn to Gov Token by proposalLsig
    *   b) Call to DAO app by proposalLsig + asset transfer transaction from depositLsig -> proposalLsig
    */

    govTokenID = runtime.addAsset(
      'gov-token', { creator: { ...creator.account, name: 'dao-creator' } });

    const daoAppArgs = [
      `int:${deposit}`,
      `int:${minSupport}`,
      `int:${minDuration}`,
      `int:${maxDuration}`,
      `str:${url}`
    ];

    const approvalProgram = getProgram('dao-app-approval.py', { ARG_GOV_TOKEN: govTokenID });
    const clearProgram = getProgram('dao-app-clear.py');

    // create application
    appID = runtime.addApp(
      { ...appCreationFlags, appArgs: daoAppArgs }, {}, approvalProgram, clearProgram);

    // setup lsig accounts
    // Initialize issuer lsig with bond-app ID
    const scInitParam = {
      ARG_GOV_TOKEN: govTokenID,
      ARG_DAO_APP_ID: appID
    };
    const depositLsigProg = getProgram('deposit-lsig.py', scInitParam);
    depositLsig = runtime.createLSigAccount(depositLsigProg, []);
    depositLsigAcc = runtime.getAccount(depositLsig.address());

    const daoFundLsigProg = getProgram('dao-fund-lsig.py', scInitParam);
    daoFundLsig = runtime.createLSigAccount(daoFundLsigProg, []);
    daoFundLsigAcc = runtime.getAccount(daoFundLsig.address());

    const proposalLsigProg = getProgram('proposal-lsig.py',
      { ARG_OWNER: proposer.address, ARG_DAO_APP_ID: appID });
    proposalLsig = runtime.createLSigAccount(proposalLsigProg, []);
    proposalLsigAcc = runtime.getAccount(proposalLsig.address());

    // fund lsig's
    for (const lsig of [depositLsig, daoFundLsig, proposalLsig]) {
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
    for (const acc of [proposer, voterA, voterB, depositLsigAcc, daoFundLsigAcc]) {
      runtime.optIntoASA(govTokenID, acc.address, {});
    }
    syncAccounts();

    // verify optIn
    for (const acc of [proposer, voterA, voterB, depositLsigAcc, daoFundLsigAcc]) {
      assert.isDefined(acc.getAssetHolding(govTokenID));
    }

    // GOV Token distribution (used as initial fund)
    const distributeGovTokenParams = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: creator.account,
      amount: 100,
      assetID: govTokenID,
      payFlags: { totalFee: 1000 }
    };

    runtime.executeTx([
      { ...distributeGovTokenParams, toAccountAddr: proposer.address },
      { ...distributeGovTokenParams, toAccountAddr: voterA.address },
      { ...distributeGovTokenParams, toAccountAddr: voterB.address }
    ]);
    syncAccounts();

    assert.equal(proposer.getAssetHolding(govTokenID).amount, 100);
    assert.equal(voterA.getAssetHolding(govTokenID).amount, 100);
    assert.equal(voterB.getAssetHolding(govTokenID).amount, 100);

    /* --------------------  Add proposal  -------------------- */

    // optIn to DAO by proposalLsig
    runtime.optInToApp(proposalLsig.address(), appID, {}, {});

    let beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    const addProposalTx = mkProposalTx(
      appID,
      govTokenID,
      proposer.account,
      depositLsig,
      proposalLsig,
      daoFundLsig
    );

    // set time (after now)
    runtime.setRoundAndTimestamp(5, now + 10);

    addProposalTx[1].amount = 15;
    runtime.executeTx(addProposalTx);
    syncAccounts();

    // assert proposal config is added
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'name'), parsing.stringToBytes('my-custom-proposal'));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'url'), parsing.stringToBytes('www.myurl.com'));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'url_hash'), parsing.stringToBytes('url-hash'));
    // empty hash_algo must save sha256
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'hash_algo'), parsing.stringToBytes('sha256'));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'voting_start'), BigInt(now + (1 * 60)));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'voting_end'), BigInt(now + (3 * 60)));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'execute_before'), BigInt(now + (7 * 60)));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'type'), BigInt(ProposalType.ALGO_TRANSFER));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'from'), parsing.addressToPk(daoFundLsig.address()));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'recipient'), parsing.addressToPk(proposer.address));
    assert.deepEqual(proposalLsigAcc.getLocalState(appID, 'amount'), BigInt(2e6));

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
    runtime.setRoundAndTimestamp(10, now + (2 * 60));

    // call to DAO app by voter (to register deposited votes)
    const registerVoteParam = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      appID: appID,
      payFlags: { totalFee: 2000 },
      accounts: [proposalLsig.address()]
    };

    // voting by user A
    const registerVoteA = {
      ...registerVoteParam,
      fromAccount: voterA.account,
      appArgs: ['str:register_vote', `str:${Vote.YES}`]
    };
    runtime.executeTx(registerVoteA);

    // voting by user B
    const registerVoteB = {
      ...registerVoteParam,
      fromAccount: voterB.account,
      appArgs: ['str:register_vote', `str:${Vote.ABSTAIN}`]
    };
    runtime.executeTx(registerVoteB);
    syncAccounts();

    // concatination of "p_" & proposalLsig.address
    const key = new Uint8Array([...parsing.stringToBytes('p_'), ...parsing.addressToPk(proposalLsig.address())]);

    // verify sender account has p_proposal set
    assert.isDefined(voterA.getLocalState(appID, key));
    assert.isDefined(voterA.getLocalState(appID, key));

    // verify voting count
    // + voterA registered 6 "yes" votes
    // + voterB registered 8 "abstain" votes
    assert.equal(proposalLsigAcc.getLocalState(appID, 'yes'), 6n);
    assert.equal(proposalLsigAcc.getLocalState(appID, 'abstain'), 8n);
    assert.isUndefined(proposalLsigAcc.getLocalState(appID, 'no')); // we didn't vote for "no"

    /* --------------------  Execute  -------------------- */

    runtime.setRoundAndTimestamp(15, now + (5 * 60));

    // verify proposal not executed before
    assert.equal(proposalLsigAcc.getLocalState(appID, 'executed'), 0n);

    const beforeProposerBal = proposer.balance();
    const executeParams = [
      {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: proposer.account,
        appID: appID,
        payFlags: { totalFee: 2000 },
        appArgs: ['str:execute'],
        accounts: [proposalLsig.address()]
      },
      // tx1 as per proposal instructions (set in ./add_proposal.js)
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: daoFundLsig.address(),
        toAccountAddr: proposer.address,
        amountMicroAlgos: 2e6,
        lsig: daoFundLsig,
        payFlags: { totalFee: 0 } // fee must be paid by proposer
      }
    ];
    runtime.executeTx(executeParams);
    syncAccounts();

    // verify executed is set to be true
    assert.equal(proposalLsigAcc.getLocalState(appID, 'executed'), 1n);

    // verify payment recieved from dao fund
    assert.equal(proposer.balance(), beforeProposerBal + BigInt(2e6) - 2000n);

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
      proposalLsig.address()
    );
    runtime.executeTx(clearRecordVoterA);

    // clear voterB record
    const clearRecordVoterB = mkClearVoteRecordTx(
      appID,
      voterB.account,
      proposalLsig.address()
    );
    runtime.executeTx(clearRecordVoterB);
    syncAccounts();

    // verify sender account has p_proposal removed after clear record
    assert.isUndefined(voterA.getLocalState(appID, key));
    assert.isUndefined(voterA.getLocalState(appID, key));

    /* --------------------  Clear Proposal  -------------------- */

    // optIn to GovToken by proposalLsig (protected by proposer account using opt-in lock)
    const optInTx = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: proposer.account,
        toAccountAddr: proposalLsig.address(),
        amountMicroAlgos: 0,
        payFlags: {}
      },
      {
        type: types.TransactionType.OptInASA,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: proposalLsig.address(),
        lsig: proposalLsig,
        assetID: govTokenID,
        payFlags: {}
      }
    ];
    runtime.executeTx(optInTx);
    syncAccounts();

    assert.isDefined(proposalLsigAcc.getAssetHolding(govTokenID));

    const clearProposalParam = mkClearProposalTx(
      appID,
      govTokenID,
      depositLsig,
      proposalLsig,
      15 // set as deposit in DAO App
    );
    runtime.executeTx(clearProposalParam);
    syncAccounts();

    // verify proposalLsig recieved back deposit of 15 tokens
    assert.equal(proposalLsigAcc.getAssetHolding(govTokenID).amount, 15n);

    // verify proposal config is deleted from localstate
    for (
      const key of ['name', 'url', 'url_hash', 'hash_algo', 'voting_start',
        'voting_end', 'execute_before', 'type', 'from', 'recipient',
        'amount', 'yes', 'no', 'abstain']
    ) {
      assert.isUndefined(proposalLsigAcc.getLocalState(appID, key));
    }
  });
});
