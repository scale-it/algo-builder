const { getProgram, convert } = require('@algo-builder/algob');
const {
  Runtime, AccountStore
} = require('@algo-builder/runtime');
const { types } = require('@algo-builder/web');
const { assert } = require('chai');

const { 
  optIn, createDex, approvalProgram,
  clearProgram, minBalance, initialBalance ,
  coupon, issue, redeem
} = require('./common/common');

/**
 * Test for the scenario described in Readme.md
 */
describe('Bond token Tests', function () {
  const master = new AccountStore(1000e6);
  let appManager = new AccountStore(initialBalance);
  let bondTokenCreator = new AccountStore(initialBalance);
  let issuerAddress = new AccountStore(minBalance);
  let elon = new AccountStore(initialBalance);
  let bob = new AccountStore(initialBalance);
  let dex1 = new AccountStore(initialBalance);
  let dex2 = new AccountStore(initialBalance);

  let runtime;
  let flags;
  let applicationId;
  let issuerLsigAddress;
  let lsig;
  let newBondIndex;

  this.beforeAll(async function () {
    runtime = new Runtime([
      appManager, bondTokenCreator,
      issuerAddress, master, elon,
      bob, dex1, dex2
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
  }

  // Bond-Dapp initialization parameters
  const appManagerPk = convert.addressToPk(appManager.address);
  const issuePrice = 'int:1000';
  const couponValue = 'int:20';
  const maxIssuance = 'int:1000000';
  const bondCreator = convert.addressToPk(bondTokenCreator.address);

  it('Bond token application', () => {
    /**
     * This test demonstrates how to create a Bond token Application
     * and interact with it. there are following operations that are performed:
     * - Create bond tokens
     * - Create the application
     * - Update the application with issuer's address
     * - Issue bond tokens
     * - Buy bond tokens
     */

    const currentBondIndex = runtime.addAsset(
      'bond-token-0', { creator: { ...bondTokenCreator.account, name: 'bond-token-creator' } });

    const creationFlags = Object.assign({}, flags);
    const creationArgs = [
      appManagerPk,
      bondCreator,
      issuePrice,
      couponValue,
      `int:${currentBondIndex}`,
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
    let issuerLsigProg = getProgram('issuer-lsig.py', scInitParam);
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

    // verify global state
    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('app_manager'), convert.addressToPk(appManager.address));
    assert.deepEqual(getGlobal('issue_price'), 1000n);
    assert.deepEqual(getGlobal('coupon_value'), 20n);
    assert.deepEqual(getGlobal('epoch'), 0n);
    assert.deepEqual(getGlobal('current_bond'), BigInt(currentBondIndex));

    // update application with correct issuer account address
    const appArgs = ['str:update_issuer_address', convert.addressToPk(issuerLsigAddress)]; // converts algorand address to Uint8Array

    const appCallParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: appManager.account,
      appID: applicationId,
      payFlags: {},
      appArgs: appArgs
    };
    runtime.executeTx(appCallParams);

    // verify issuer address
    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('issuer_address'), convert.addressToPk(issuerLsigAddress));

    // opt-in to app
    runtime.optInToApp(appManager.address, applicationId, {}, {});
    runtime.optInToApp(issuerAddress.address, applicationId, {}, {});

    syncAccounts();
    assert.isDefined(appManager.appsLocalState.get(applicationId));
    assert.isDefined(issuerAddress.appsLocalState.get(applicationId));

    runtime = optIn(runtime, lsig, currentBondIndex, appManager);

    // Issue tokens to issuer from bond token creator
    let groupTx = [
      // Bond asa transfer to issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: bondTokenCreator.account,
        toAccountAddr: issuerLsigAddress,
        amount: 1e6,
        assetID: currentBondIndex,
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

    syncAccounts();
    assert.equal(issuerAddress.getAssetHolding(currentBondIndex)?.amount, 1000000n);

    // epoch_0 elon buys 10 bonds
    runtime.optIntoASA(currentBondIndex, elon.address, {});
    runtime.optInToApp(elon.address, applicationId, {}, {});
    let amount = 10;
    let algoAmount = amount * issue;

    groupTx = [
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
        assetID: currentBondIndex,
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
    assert.equal(elon.getAssetHolding(currentBondIndex)?.amount, 10n);

    runtime.optIntoASA(currentBondIndex, bob.address, {});
    // elon sells 2 bonds to bob for 2020 Algo
    const sellTx = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: bob.account,
        toAccountAddr: bob.address,
        amountMicroAlgos: 2020,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        toAccountAddr: bob.address,
        amount: 2,
        assetID: currentBondIndex,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(sellTx);
    syncAccounts();
    assert.equal(elon.getAssetHolding(currentBondIndex)?.amount, 8n);
    assert.equal(bob.getAssetHolding(currentBondIndex)?.amount, 2n);

    let dexLsig1;
    // manager starts epoch 1 (create dex)
    [runtime, dexLsig1] = createDex(runtime, bondTokenCreator, appManager, 1, master, lsig);
    syncAccounts();
    // sync dex account
    dex1 = runtime.getAccount(dexLsig1.address());
    console.log('Dex 1 Address: ', dexLsig1.address());

    // elon redeems his 8 bonds
    runtime = redeem(runtime, elon, 1, 8, dexLsig1);

    amount = 4;
    algoAmount = amount * issue;
    const bond1 = runtime.getAssetInfoFromName('bond-token-1').assetIndex;
    // elon buys 4 more bonds
    groupTx = [
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
        amount: amount,
        assetID: bond1,
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
    assert.equal(elon.getAssetHolding(bond1)?.amount, 12n);

    // manager starts epoch 2 (create dex)
    let dexLsig2;
    [runtime, dexLsig2] = createDex(runtime, bondTokenCreator, appManager, 2, master, lsig);
    syncAccounts();
    // sync dex account
    dex2 = runtime.getAccount(dexLsig2.address());
    console.log('Dex 2 Address: ', dexLsig2.address());

    // elon redeems his 12 bonds
    runtime = redeem(runtime, elon, 2, 12, dexLsig2);

    // bob redeems bond_1
    runtime = redeem(runtime, bob, 1, 2, dexLsig1);
    syncAccounts();
    // bob redeems bond_2
    runtime = redeem(runtime, bob, 2, 2, dexLsig2);

    const bond2 = runtime.getAssetInfoFromName('bond-token-2').assetIndex;
    // create buyback
    const scParam = {
      TMPL_APPLICATION_ID: applicationId,
      TMPL_APP_MANAGER: appManager.address,
      TMPL_BOND: bond2
    };
    const buyLsigProgram = getProgram('buyback-lsig.py', scParam);
    let buybackLsig = runtime.getLogicSig(buyLsigProgram, []);

    // fund dex with some minimum balance first
    const fundDexParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: buybackLsig.address(),
      amountMicroAlgos: minBalance + 10000,
      payFlags: {}
    };
    runtime.executeTx(fundDexParam);

    const buybackTx = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: appManager.account,
      appID: applicationId,
      payFlags: {},
      appArgs: ['str:set_buyback', convert.addressToPk(buybackLsig.address())]
    };

    optIn(runtime, buybackLsig, bond2, appManager);

    runtime.executeTx(buybackTx);

    runtime.setRoundAndTimestamp(3, Math.round(new Date().getTime() / 1000) + 250);

    let exitBond = 12;
    let nominalPrice = 1000;
    let exitAmount = Number(exitBond) * Number(nominalPrice);
    // Exit tokens from elon
    let exitTx = [
      //  Bond token transfer to buyback address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        toAccountAddr: buybackLsig.address(),
        amount: exitBond,
        assetID: bond2,
        payFlags: { totalFee: 2000 }
      },
      // Nominal price * amount paid to buyer
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: buybackLsig.address(),
        lsig: buybackLsig,
        toAccountAddr: elon.address,
        amountMicroAlgos: exitAmount,
        payFlags: { totalFee: 0 }
      },
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: elon.account,
        appID: applicationId,
        payFlags: { totalFee: 1000 },
        appArgs: ['str:exit']
      }
    ];

    runtime.executeTx(exitTx);

    // Exit tokens from bob
    exitTx[0].fromAccount = bob.account;
    exitTx[0].amount = 2;
    exitTx[1].toAccountAddr = bob.address;
    exitTx[1].amountMicroAlgos = 2000;
    exitTx[2].fromAccount = bob.account;

    runtime.executeTx(exitTx);
    syncAccounts();
    assert.equal(bob.getAssetHolding(bond1)?.amount, 0n);
    assert.equal(bob.getAssetHolding(bond2)?.amount, 0n);
    assert.equal(elon.getAssetHolding(bond1)?.amount, 0n);
    assert.equal(elon.getAssetHolding(bond2)?.amount, 0n);
    // check algo balance
  });
});
