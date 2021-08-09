const { getProgram, convert } = require('@algo-builder/algob');
const {
  Runtime, AccountStore
} = require('@algo-builder/runtime');
const { types } = require('@algo-builder/web');
const { assert } = require('chai');
const {
  optIn, createDex, approvalProgram,
  clearProgram, minBalance, initialBalance,
  issue, redeem
} = require('./common/common');

const RUNTIME_ERR1009 = 'RUNTIME_ERR1009: TEAL runtime encountered err opcode';
const RUNTIME_ERR1402 = 'Cannot withdraw';
const REJECTED_BY_LOGIC = 'RUNTIME_ERR1007: Teal code rejected by logic';
const updateIssuer = 'str:update_issuer_address';

describe('Bond token failing tests', function () {
  const master = new AccountStore(1000e6);
  let appManager = new AccountStore(initialBalance);
  let bondTokenCreator = new AccountStore(initialBalance);
  let issuerAddress = new AccountStore(minBalance);
  let elon = new AccountStore(initialBalance);
  let bob = new AccountStore(initialBalance);
  let dex1 = new AccountStore(initialBalance);
  let dex2 = new AccountStore(initialBalance);
  let randomUser = new AccountStore(initialBalance);

  let runtime;
  let flags;
  let applicationId;
  let issuerLsigAddress;
  let lsig;
  let initialBond;

  this.beforeAll(async function () {
    runtime = new Runtime([
      appManager, bondTokenCreator,
      issuerAddress, master, elon,
      bob, dex1, dex2, randomUser
    ]);

    flags = {
      sender: appManager.account,
      localInts: 1,
      localBytes: 1,
      globalInts: 8,
      globalBytes: 15
    };
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationId, key);

  // fetch latest account state
  function syncAccounts () {
    appManager = runtime.getAccount(appManager.address);
    bondTokenCreator = runtime.getAccount(bondTokenCreator.address);
    issuerAddress = runtime.getAccount(issuerAddress.address);
    elon = runtime.getAccount(elon.address);
    dex1 = runtime.getAccount(dex1.address);
    dex2 = runtime.getAccount(dex2.address);
    bob = runtime.getAccount(bob.address);
    randomUser = runtime.getAccount(randomUser.address);
  }

  // Bond-Dapp initialization parameters
  const appManagerPk = convert.addressToPk(appManager.address);
  const issuePrice = 'int:1000';
  const couponValue = 'int:20';
  const maxIssuance = 'int:1000000';
  const bondCreator = convert.addressToPk(bondTokenCreator.address);

  this.beforeEach(async function () {
    initialBond = runtime.addAsset(
      'bond-token-0', { creator: { ...bondTokenCreator.account, name: 'bond-token-creator' } });

    const creationFlags = Object.assign({}, flags);
    const creationArgs = [
      appManagerPk,
      bondCreator,
      issuePrice,
      couponValue,
      `int:${initialBond}`,
      maxIssuance
    ];

    // create application
    applicationId = runtime.addApp(
      { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);

    // setup lsig account
    // Initialize issuer lsig with bond-app ID
    const scInitParam = {
      TMPL_APPLICATION_ID: applicationId,
      TMPL_OWNER: bondTokenCreator.address,
      TMPL_APP_MANAGER: appManager.address
    };
    const issuerLsigProg = getProgram('issuer-lsig.py', scInitParam);
    lsig = runtime.getLogicSig(issuerLsigProg, []);
    issuerLsigAddress = lsig.address();

    // sync escrow account
    issuerAddress = runtime.getAccount(issuerLsigAddress);
    console.log('Issuer Address: ', issuerLsigAddress);

    // fund escrow with some minimum balance first
    const fundEscrowParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: issuerLsigAddress,
      amountMicroAlgos: minBalance + 10000,
      payFlags: {}
    };
    runtime.executeTx(fundEscrowParam);
  });

  function issue () {
    const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)];

    const appCallParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: appManager.account,
      appID: applicationId,
      payFlags: {},
      appArgs: appArgs
    };
    runtime.executeTx(appCallParams);
    runtime = optIn(runtime, lsig, initialBond, appManager);

    // Issue tokens to issuer from bond token creator
    const groupTx = [
      // Bond asa transfer to issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: bondTokenCreator.account,
        toAccountAddr: issuerLsigAddress,
        amount: 1e6,
        assetID: initialBond,
        payFlags: { }
      },
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: bondTokenCreator.account,
        appID: applicationId,
        payFlags: {},
        appArgs: ['str:issue']
      }
    ];
    runtime.executeTx(groupTx);
  }

  function buy () {
    runtime.optIntoASA(initialBond, elon.address, {});
    runtime.optInToApp(elon.address, applicationId, {}, {});
    const amount = 10;
    const algoAmount = amount * 1000;

    const groupTx = [
      // Algo transfer from elon to issuer
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        toAccountAddr: issuerLsigAddress,
        amountMicroAlgos: algoAmount,
        payFlags: { totalFee: 2000 }
      },
      // Bond token transfer from issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: issuerLsigAddress,
        lsig: lsig,
        toAccountAddr: elon.address,
        amount: 10,
        assetID: initialBond,
        payFlags: { totalFee: 0 }
      },
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        appID: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:buy']
      }
    ];

    runtime.executeTx(groupTx);
    syncAccounts();
  }

  it("Random user should not be able to update issuer's address", () => {
    // update application with correct issuer account address
    const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)]; // converts algorand address to Uint8Array

    const appCallParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: randomUser.account,
      appID: applicationId,
      payFlags: {},
      appArgs: appArgs
    };

    assert.throws(() => runtime.executeTx(appCallParams), RUNTIME_ERR1009);
  });

  it('Issuer should not be able to send asa without calling bond-dapp', () => {
    const params = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: issuerLsigAddress,
      lsig: lsig,
      toAccountAddr: elon.address,
      amount: 10,
      assetID: initialBond,
      payFlags: { totalFee: 1000 }
    };

    assert.throws(() => runtime.executeTx(params), REJECTED_BY_LOGIC);
  });

  it('Opt-In to issuer lsig with single transaction should fail', () => {
    const optInTx = {
      type: types.TransactionType.OptInASA,
      sign: types.SignType.LogicSignature,
      fromAccountAddr: issuerLsigAddress,
      lsig: lsig,
      assetID: initialBond,
      payFlags: {}
    };

    assert.throws(() => runtime.executeTx(optInTx), REJECTED_BY_LOGIC);
  });

  // Avoid spamming of asset id's in bond-dapp
  it('Opt-In to issuer lsig without store manager signature should fail', () => {
    const optInTx = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: randomUser.account,
        toAccountAddr: issuerLsigAddress,
        amountMicroAlgos: 0,
        payFlags: {}
      },
      {
        type: types.TransactionType.OptInASA,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: issuerLsigAddress,
        lsig: lsig,
        assetID: initialBond,
        payFlags: {}
      }
    ];

    assert.throws(() => runtime.executeTx(optInTx), REJECTED_BY_LOGIC);
  });

  it('Random user should not be able to update issue price', () => {
    const appArgs = ['str:update_issue_price', 'int:0'];

    const appCallParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: randomUser.account,
      appID: runtime.getAppInfoFromName(approvalProgram, clearProgram).appID,
      payFlags: {},
      appArgs: appArgs
    };

    assert.throws(() => runtime.executeTx(appCallParams), RUNTIME_ERR1009);
  });

  it("should not issue shares to address other than issuer's address", () => {
    const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)];

    const appCallParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: appManager.account,
      appID: applicationId,
      payFlags: {},
      appArgs: appArgs
    };
    runtime.executeTx(appCallParams);
    runtime = optIn(runtime, lsig, initialBond, appManager);
    runtime.optIntoASA(initialBond, elon.address, {});

    const groupTx = [
      // Bond asa transfer to issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: bondTokenCreator.account,
        toAccountAddr: elon.address,
        amount: 1e6,
        assetID: initialBond,
        payFlags: { }
      },
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: bondTokenCreator.account,
        appID: applicationId,
        payFlags: {},
        appArgs: ['str:issue']
      }
    ];

    assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
  });

  it('User should not be able to buy for less amount than specified', () => {
    issue();

    // Buy tokens from issuer
    runtime.optIntoASA(initialBond, elon.address, {});
    runtime.optInToApp(elon.address, applicationId, {}, {});
    const algoAmount = 10 * 1000;

    const groupTx = [
      // Algo transfer from buyer to issuer
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        toAccountAddr: issuerLsigAddress,
        amountMicroAlgos: algoAmount - 10,
        payFlags: {}
      },
      // Bond token transfer from issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: issuerLsigAddress,
        lsig: lsig,
        toAccountAddr: elon.address,
        amount: 10,
        assetID: initialBond,
        payFlags: { totalFee: 1000 }
      },
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        appID: applicationId,
        payFlags: {},
        appArgs: ['str:buy']
      }
    ];

    assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
  });

  it('Only store manager can create dex', () => {
    issue();
    buy();

    assert.throws(() => createDex(
      runtime, bondTokenCreator, elon, 1, master, lsig
    ), REJECTED_BY_LOGIC);
  });

  it('Buyer cannot redeem more than they have', () => {
    issue();
    buy();
    createDex(runtime, bondTokenCreator, appManager, 1, master, lsig);

    let dexLsig1;
    // manager starts epoch 1 (create dex)
    [runtime, dexLsig1] = createDex(runtime, bondTokenCreator, appManager, 1, master, lsig);
    syncAccounts();
    // sync dex account
    dex1 = runtime.getAccount(dexLsig1.address());
    console.log('Dex 1 Address: ', dexLsig1.address());

    assert.throws(() => redeem(runtime, elon, 1, 20, dexLsig1), RUNTIME_ERR1402);
  });
});
