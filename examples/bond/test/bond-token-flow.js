const { getProgram, convert } = require('@algo-builder/algob');
const {
  Runtime, AccountStore
} = require('@algo-builder/runtime');
const { types } = require('@algo-builder/web');
const { assert } = require('chai');

const minBalance = 10e6; // 10 ALGO's
const initialBalance = 200e6;

describe('Bond token Tests', function () {
  const master = new AccountStore(1000e6);
  let storeManager = new AccountStore(initialBalance);
  let bondTokenCreator = new AccountStore(initialBalance);
  let issuerAddress = new AccountStore(minBalance);
  let buyer = new AccountStore(initialBalance);
  let dex = new AccountStore(initialBalance);

  let runtime;
  let flags;
  let applicationId;
  let issuerLsigAddress;
  let lsig;
  let newBondIndex;
  const approvalProgram = getProgram('bond-dapp-stateful.py');
  const clearProgram = getProgram('bond-dapp-clear.py');

  this.beforeAll(async function () {
    runtime = new Runtime([storeManager, bondTokenCreator, issuerAddress, master, buyer, dex]);

    flags = {
      sender: storeManager.account,
      localInts: 1,
      localBytes: 1,
      globalInts: 8,
      globalBytes: 15
    };
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationId, key);

  // fetch latest account state
  function syncAccounts () {
    storeManager = runtime.getAccount(storeManager.address);
    bondTokenCreator = runtime.getAccount(bondTokenCreator.address);
    issuerAddress = runtime.getAccount(issuerAddress.address);
    buyer = runtime.getAccount(buyer.address);
    dex = runtime.getAccount(dex.address);
  }

  function optIn (lsigAddress, lsig, assetID) {
    // Only store manager can allow opt-in to ASA for lsig
    const optInTx = [
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: storeManager.account,
        toAccountAddr: lsigAddress,
        amountMicroAlgos: 0,
        payFlags: {}
      },
      {
        type: types.TransactionType.OptInASA,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: lsigAddress,
        lsig: lsig,
        assetID: assetID,
        payFlags: {}
      }
    ];
    runtime.executeTx(optInTx);
  }

  // Bond-Dapp initialization parameters
  const storeManagerPk = convert.addressToPk(storeManager.address);
  const issuePrice = 'int:1000';
  const nominalPrice = 'int:1000';
  const matDate = Math.round(new Date().getTime() / 1000) + 1000;
  const maturityDate = convert.uint64ToBigEndian(matDate);
  const couponValue = 'int:100';
  const epoch = 'int:0';
  const maxAmount = 'int:1000000';
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
      'bond-token', { creator: { ...bondTokenCreator.account, name: 'bond-token-creator' } });

    const creationFlags = Object.assign({}, flags);
    const creationArgs = [
      storeManagerPk, issuePrice,
      nominalPrice, maturityDate,
      couponValue, epoch,
      `int:${currentBondIndex}`,
      maxAmount, bondCreator
    ];

    // create application
    applicationId = runtime.addApp(
      { ...creationFlags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);

    // setup lsig account
    // Initialize issuer lsig with bond-app ID
    const scInitParam = {
      TMPL_APPLICATION_ID: applicationId,
      TMPL_OWNER: bondTokenCreator.address,
      TMPL_STORE_MANAGER: storeManager.address
    };
    const issuerLsig = getProgram('issuer-lsig.py', scInitParam);
    lsig = runtime.getLogicSig(issuerLsig, []);
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
    assert.deepEqual(getGlobal('store_manager'), convert.addressToPk(storeManager.address));
    assert.deepEqual(getGlobal('issue_price'), 1000n);
    assert.deepEqual(getGlobal('nominal_price'), 1000n);
    assert.deepEqual(getGlobal('maturity_date'), BigInt(matDate));
    assert.deepEqual(getGlobal('coupon_value'), 100n);
    assert.deepEqual(getGlobal('epoch'), 0n);
    assert.deepEqual(getGlobal('current_bond'), BigInt(currentBondIndex));

    // update application with correct issuer account address
    const appArgs = ['str:update_issuer_address', convert.addressToPk(issuerLsigAddress)]; // converts algorand address to Uint8Array

    const appCallParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: storeManager.account,
      appID: applicationId,
      payFlags: {},
      appArgs: appArgs
    };
    runtime.executeTx(appCallParams);

    // verify issuer address
    assert.isDefined(applicationId);
    assert.deepEqual(getGlobal('issuer_address'), convert.addressToPk(issuerLsigAddress));

    // opt-in to app
    runtime.optInToApp(storeManager.address, applicationId, {}, {});
    runtime.optInToApp(issuerAddress.address, applicationId, {}, {});

    syncAccounts();
    assert.isDefined(storeManager.appsLocalState.get(applicationId));
    assert.isDefined(issuerAddress.appsLocalState.get(applicationId));

    // set timestamp
    runtime.setRoundAndTimestamp(5, matDate - 100);

    optIn(issuerLsigAddress, lsig, currentBondIndex);

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

    // Buy tokens from issuer
    runtime.optIntoASA(currentBondIndex, buyer.address, {});
    runtime.optInToApp(buyer.address, applicationId, {}, {});
    const algoAmount = 10 * 1000 + 1000;

    groupTx = [
      // Algo transfer from buyer to issuer
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: buyer.account,
        toAccountAddr: issuerLsigAddress,
        amountMicroAlgos: algoAmount,
        payFlags: {}
      },
      // Bond token transfer from issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: issuerLsigAddress,
        lsig: lsig,
        toAccountAddr: buyer.address,
        amount: 10,
        assetID: currentBondIndex,
        payFlags: { totalFee: 1000 }
      },
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: buyer.account,
        appID: applicationId,
        payFlags: {},
        appArgs: ['str:buy']
      }
    ];

    runtime.executeTx(groupTx);

    syncAccounts();
    assert.equal(buyer.getAssetHolding(currentBondIndex)?.amount, 10n);

    // Create B_i+1 bond token
    newBondIndex = runtime.addAsset(
      'new-bond-token', { creator: { ...bondTokenCreator.account, name: 'bond-token-creator' } });

    optIn(issuerLsigAddress, lsig, newBondIndex);

    // Create dex
    const param = {
      TMPL_OLD_BOND: currentBondIndex,
      TMPL_NEW_BOND: newBondIndex,
      TMPL_APPLICATION_ID: applicationId,
      TMPL_STORE_MANAGER: storeManager.address
    };
    const dexLsigProgram = getProgram('dex-lsig.py', param);
    const dexLsig = runtime.getLogicSig(dexLsigProgram, []);
    const dexLsigAddress = dexLsig.address();

    // sync dex account
    dex = runtime.getAccount(dexLsigAddress);
    console.log('Dex Address: ', dexLsigAddress);

    // fund dex with some minimum balance first
    const fundDexParam = {
      type: types.TransactionType.TransferAlgo,
      sign: types.SignType.SecretKey,
      fromAccount: master.account,
      toAccountAddr: dexLsigAddress,
      amountMicroAlgos: minBalance + 10000,
      payFlags: {}
    };
    runtime.executeTx(fundDexParam);

    optIn(dexLsigAddress, dexLsig, currentBondIndex);
    optIn(dexLsigAddress, dexLsig, newBondIndex);

    const total = getGlobal('total');
    // Transfer total amount to dex lsig
    const transferTx = {
      type: types.TransactionType.TransferAsset,
      sign: types.SignType.SecretKey,
      fromAccount: bondTokenCreator.account,
      toAccountAddr: dexLsigAddress,
      amount: total,
      assetID: newBondIndex,
      payFlags: { totalFee: 1000 }
    };
    runtime.executeTx(transferTx);

    syncAccounts();
    assert.equal(dex.getAssetHolding(newBondIndex)?.amount, BigInt(total));

    const assetAmount = issuerAddress.getAssetHolding(currentBondIndex)?.amount;
    groupTx = [
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: storeManager.account,
        appID: applicationId,
        payFlags: {},
        appArgs: ['str:create_dex'],
        accounts: [issuerLsigAddress]
      },
      // New bond token transfer to issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: bondTokenCreator.account,
        toAccountAddr: issuerLsigAddress,
        amount: assetAmount,
        assetID: newBondIndex,
        payFlags: { totalFee: 1000 }
      },
      // burn tokens
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: issuerLsigAddress,
        lsig: lsig,
        toAccountAddr: bondTokenCreator.address,
        amount: assetAmount,
        assetID: currentBondIndex,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(groupTx);

    syncAccounts();
    assert.equal(issuerAddress.getAssetHolding(currentBondIndex)?.amount, 0n);
    assert.equal(issuerAddress.getAssetHolding(newBondIndex)?.amount, BigInt(assetAmount));
    assert.equal(bondTokenCreator.getAssetHolding(newBondIndex)?.amount, 0n);

    // Exhange old tokens for new ones
    runtime.optIntoASA(newBondIndex, buyer.address, {});
    groupTx = [
      // Transfer tokens to dex lsig.
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: buyer.account,
        toAccountAddr: dexLsigAddress,
        amount: 10,
        assetID: currentBondIndex,
        payFlags: { totalFee: 1000 }
      },
      // New bond token transfer to buyer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: dexLsigAddress,
        lsig: dexLsig,
        toAccountAddr: buyer.address,
        amount: 10,
        assetID: newBondIndex,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.LogicSignature,
        fromAccountAddr: dexLsigAddress,
        lsig: dexLsig,
        toAccountAddr: buyer.address,
        amountMicroAlgos: 1000,
        payFlags: {}
      },
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: buyer.account,
        appID: applicationId,
        payFlags: {},
        appArgs: ['str:redeem_coupon']
      }
    ];

    runtime.executeTx(groupTx);

    syncAccounts();
    assert.equal(buyer.getAssetHolding(currentBondIndex)?.amount, 0n);
    assert.equal(buyer.getAssetHolding(newBondIndex)?.amount, 10n);
  });
});
