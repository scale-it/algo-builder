const { getProgram, convert } = require('@algo-builder/algob');
const {
  Runtime, AccountStore
} = require('@algo-builder/runtime');
const { types, parsing } = require('@algo-builder/web');
const { assert } = require('chai');
const { ProposalType, Vote } = require('../scripts/run/common/common');
const {
  now, getAddProposalTx, getDepositVoteTokenTx, getWithdrawVoteDepositTx,
  getClearVoteRecordTx, getClearProposalTx
} = require('../scripts/run/common/tx-params');

const minBalance = 10e6; // 10 ALGO's
const initialBalance = 200e6;

/**
 * Test for scripts flow. Steps:
 * + create DAO (setup)
 * + add proposal
 * + deposit vote tokens
 * + register vote
 * + execute proposal
 * + withdraw vote deposit
 * + clear vote record
 * + clear proposal
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
  let flags;
  let applicationID;
  let govTokenID;
  let depositLsig;
  let daoFundLsig;
  let proposalLsig;

  this.beforeAll(async function () {
    runtime = new Runtime([
      master, creator, proposer, voterA, voterB,
      depositLsigAcc, daoFundLsigAcc, proposalLsigAcc
    ]);

    flags = {
      sender: creator.account,
      localInts: 9,
      localBytes: 7,
      globalInts: 4,
      globalBytes: 2
    };
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationID, key);

  // fetch latest account state
  function syncAccounts () {
    // [
    //   creator, proposer, voterA, voterB,
    //   depositLsigAcc, daoFundLsigAcc, proposalLsigAcc
    // ].map((acc) => runtime.getAccount(acc.address));
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
    govTokenID = runtime.addAsset(
      'gov-token', { creator: { ...creator.account, name: 'dao-creator' } });

    const creationFlags = Object.assign({}, flags);
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
    applicationID = runtime.addApp(
      { ...creationFlags, appArgs: daoAppArgs }, {}, approvalProgram, clearProgram);

    // setup lsig account
    // Initialize issuer lsig with bond-app ID
    const scInitParam = {
      ARG_GOV_TOKEN: govTokenID,
      ARG_DAO_APP_ID: applicationID
    };
    const depositLsigProg = getProgram('deposit-lsig.py', scInitParam);
    depositLsig = runtime.getLogicSig(depositLsigProg, []);
    depositLsigAcc = runtime.getAccount(depositLsig.address());

    const daoFundLsigProg = getProgram('dao-fund-lsig.py', scInitParam);
    daoFundLsig = runtime.getLogicSig(daoFundLsigProg, []);
    daoFundLsigAcc = runtime.getAccount(daoFundLsig.address());

    const proposalLsigProg = getProgram('proposal-lsig.py',
      { ARG_OWNER: proposer.address, ARG_DAO_APP_ID: applicationID });
    proposalLsig = runtime.getLogicSig(proposalLsigProg, []);
    proposalLsigAcc = runtime.getAccount(proposalLsig.address());

    // fund lsig's
    for (const lsig of [depositLsig, daoFundLsig, proposalLsig]) {
      runtime.fundLsig(master.account, lsig.address(), minBalance + 10000);
    }

    syncAccounts();

    // verify global state
    assert.isDefined(applicationID);
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
      appID: applicationID,
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
    runtime.optInToApp(proposalLsig.address(), applicationID, {}, {});

    let beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    const addProposalTx = getAddProposalTx(
      applicationID,
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
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'name'), parsing.stringToBytes('my-custom-proposal'));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'url'), parsing.stringToBytes('www.myurl.com'));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'url_hash'), parsing.stringToBytes('url-hash'));
    // empty hash_algo must save sha256
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'hash_algo'), parsing.stringToBytes('sha256'));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'voting_start'), BigInt(now + (1 * 60)));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'voting_end'), BigInt(now + (3 * 60)));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'execute_before'), BigInt(now + (7 * 60)));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'type'), BigInt(ProposalType.ALGO_TRANSFER));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'from'), parsing.addressToPk(daoFundLsig.address()));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'recipient'), parsing.addressToPk(proposer.address));
    assert.deepEqual(proposalLsigAcc.getLocalState(applicationID, 'amount'), BigInt(2e6));

    // verify deposit recieved in depositLsig
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 15n);

    /* --------------------  Deposit Vote Token  -------------------- */

    // optIn to DAO by voterA & voterB
    runtime.optInToApp(voterA.address, applicationID, {}, {});
    runtime.optInToApp(voterB.address, applicationID, {}, {});

    beforeBal = depositLsigAcc.getAssetHolding(govTokenID).amount;

    // deposit 6 votes by voterA
    const depositVoteParamA = getDepositVoteTokenTx(
      applicationID,
      govTokenID,
      voterA.account,
      depositLsig,
      6
    );
    runtime.executeTx(depositVoteParamA);

    const depositVoteParamB = getDepositVoteTokenTx(
      applicationID,
      govTokenID,
      voterB.account,
      depositLsig,
      8
    );
    runtime.executeTx(depositVoteParamB);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(applicationID, 'deposit'), 6n);
    assert.deepEqual(voterB.getLocalState(applicationID, 'deposit'), 8n);

    // verify 7 + 8 votes deposited
    assert.deepEqual(depositLsigAcc.getAssetHolding(govTokenID).amount, beforeBal + 6n + 8n);

    /* --------------------  Vote  -------------------- */
    runtime.setRoundAndTimestamp(10, now + (2 * 60));

    // call to DAO app by voter (to register deposited votes)
    const registerVoteParam = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      appID: applicationID,
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
    assert.isDefined(voterA.getLocalState(applicationID, key));
    assert.isDefined(voterA.getLocalState(applicationID, key));

    // verify voting count
    // + voterA registered 6 "yes" votes
    // + voterB registered 8 "abstain" votes
    assert.equal(proposalLsigAcc.getLocalState(applicationID, 'yes'), 6n);
    assert.equal(proposalLsigAcc.getLocalState(applicationID, 'abstain'), 8n);
    assert.isUndefined(proposalLsigAcc.getLocalState(applicationID, 'no')); // we didn't vote for "no"

    /* --------------------  Execute  -------------------- */

    runtime.setRoundAndTimestamp(15, now + (5 * 60));

    // verify proposal not executed before
    assert.equal(proposalLsigAcc.getLocalState(applicationID, 'executed'), 0n);

    const beforeProposerBal = proposer.balance();
    const executeParams = [
      {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: proposer.account,
        appID: applicationID,
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
    assert.equal(proposalLsigAcc.getLocalState(applicationID, 'executed'), 1n);

    // verify payment recieved from dao fund
    assert.equal(proposer.balance(), beforeProposerBal + BigInt(2e6) - 2000n);

    /* --------------------  Withdraw Vote Deposit  -------------------- */

    // before balance
    const beforeBalVoterA = voterA.getAssetHolding(govTokenID).amount;
    const beforeBalVoterB = voterB.getAssetHolding(govTokenID).amount;
    // before record of sender.deposit
    const beforeRecordVoterA = voterA.getLocalState(applicationID, 'deposit');
    const beforeRecordVoterB = voterB.getLocalState(applicationID, 'deposit');

    // withdraw 6 votes deposited by voterA
    const withdrawVoteDepositA = getWithdrawVoteDepositTx(
      applicationID,
      govTokenID,
      voterA.account,
      depositLsig,
      6
    );
    runtime.executeTx(withdrawVoteDepositA);

    // withdraw 8 votes deposited by voterB
    const withdrawVoteDepositB = getWithdrawVoteDepositTx(
      applicationID,
      govTokenID,
      voterB.account,
      depositLsig,
      8
    );
    runtime.executeTx(withdrawVoteDepositB);
    syncAccounts();

    // verify sender.deposit is set
    assert.deepEqual(voterA.getLocalState(applicationID, 'deposit'), beforeRecordVoterA - 6n);
    assert.deepEqual(voterB.getLocalState(applicationID, 'deposit'), beforeRecordVoterB - 8n);

    // verify tokens received by voterA & voterB from depositLsig
    assert.deepEqual(voterA.getAssetHolding(govTokenID).amount, beforeBalVoterA + 6n);
    assert.deepEqual(voterB.getAssetHolding(govTokenID).amount, beforeBalVoterB + 8n);

    /* --------------------  Clear Vote Record  -------------------- */

    // verify sender account has p_proposal set (before clear vote record)
    assert.isDefined(voterA.getLocalState(applicationID, key));
    assert.isDefined(voterA.getLocalState(applicationID, key));

    // clear voterA record
    const clearRecordVoterA = getClearVoteRecordTx(
      applicationID,
      voterA.account,
      proposalLsig.address()
    );
    runtime.executeTx(clearRecordVoterA);

    // clear voterB record
    const clearRecordVoterB = getClearVoteRecordTx(
      applicationID,
      voterB.account,
      proposalLsig.address()
    );
    runtime.executeTx(clearRecordVoterB);
    syncAccounts();

    // verify sender account has p_proposal removed after clear record
    assert.isUndefined(voterA.getLocalState(applicationID, key));
    assert.isUndefined(voterA.getLocalState(applicationID, key));

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

    const clearProposalParam = getClearProposalTx(
      applicationID,
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
      assert.isUndefined(proposalLsigAcc.getLocalState(applicationID, key));
    }
  });
});
