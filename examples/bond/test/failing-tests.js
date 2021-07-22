const { getProgram, convert } = require('@algo-builder/algob');
const {
  Runtime, AccountStore
} = require('@algo-builder/runtime');
const { types } = require('@algo-builder/web');
const { assert } = require('chai');

const minBalance = 10e6; // 10 ALGO's
const initialBalance = 200e6;
const RUNTIME_ERR1009 = 'RUNTIME_ERR1009: TEAL runtime encountered err opcode';
const REJECTED_BY_LOGIC = 'RUNTIME_ERR1007: Teal code rejected by logic';
const updateIssuer = 'str:update_issuer_address';

describe('Bond token failing tests', function () {
  const master = new AccountStore(1000e6);
  let storeManager = new AccountStore(initialBalance);
  let bondTokenCreator = new AccountStore(initialBalance);
  let issuerAddress = new AccountStore(minBalance);
  let buyer = new AccountStore(initialBalance);
  let dex = new AccountStore(initialBalance);
  const randomUser = new AccountStore(initialBalance);

  let runtime;
  let flags;
  let applicationId;
  let issuerLsigAddress;
  let lsig;
  let newBondIndex;
  let currentBondIndex;
  const approvalProgram = getProgram('bond-dapp-stateful.py');
  const clearProgram = getProgram('bond-dapp-clear.py');

  this.beforeEach(async function () {
    runtime = new Runtime([
      storeManager, bondTokenCreator,
      issuerAddress, master, buyer, dex, randomUser
    ]);

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
    flags = {
      sender: storeManager.account,
      localInts: 1,
      localBytes: 1,
      globalInts: 8,
      globalBytes: 15
    };
    currentBondIndex = runtime.addAsset(
      'bond-token', { creator: { ...bondTokenCreator.account, name: 'bond-token-creator' } });
    const creationArgs = [
      storeManagerPk, issuePrice,
      nominalPrice, maturityDate,
      couponValue, epoch,
      `int:${currentBondIndex}`,
      maxAmount, bondCreator
    ];

    // create application
    applicationId = runtime.addApp(
      { ...flags, appArgs: creationArgs }, {}, approvalProgram, clearProgram);

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
  });

  const getGlobal = (key) => runtime.getGlobalState(applicationId, key);

  function issue () {
    const appArgs = [updateIssuer, convert.addressToPk(issuerLsigAddress)];

    const appCallParams = {
      type: types.TransactionType.CallNoOpSSC,
      sign: types.SignType.SecretKey,
      fromAccount: storeManager.account,
      appID: applicationId,
      payFlags: {},
      appArgs: appArgs
    };
    runtime.executeTx(appCallParams);
    optIn(issuerLsigAddress, lsig, currentBondIndex);

    const groupTx = [
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
  }

  function buy () {
    runtime.optIntoASA(currentBondIndex, buyer.address, {});
    runtime.optInToApp(buyer.address, applicationId, {}, {});
    const algoAmount = 10 * 1000 + 1000;

    const groupTx = [
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
  }

  function setupDex () {
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
      amountMicroAlgos: 1e6,
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
  }

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
      toAccountAddr: buyer.address,
      amount: 10,
      assetID: currentBondIndex,
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
      assetID: currentBondIndex,
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
        assetID: currentBondIndex,
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
      appID: applicationId,
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
      fromAccount: storeManager.account,
      appID: applicationId,
      payFlags: {},
      appArgs: appArgs
    };
    runtime.executeTx(appCallParams);
    optIn(issuerLsigAddress, lsig, currentBondIndex);
    runtime.optIntoASA(currentBondIndex, buyer.address, {});

    const groupTx = [
      // Bond asa transfer to issuer's address
      {
        type: types.TransactionType.TransferAsset,
        sign: types.SignType.SecretKey,
        fromAccount: bondTokenCreator.account,
        toAccountAddr: buyer.address,
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

    assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
  });

  it('User should not be able to buy for less amount than specified', () => {
    issue();

    // Buy tokens from issuer
    runtime.optIntoASA(currentBondIndex, buyer.address, {});
    runtime.optInToApp(buyer.address, applicationId, {}, {});
    const algoAmount = 10 * 1000 + 1000;

    const groupTx = [
      // Algo transfer from buyer to issuer
      {
        type: types.TransactionType.TransferAlgo,
        sign: types.SignType.SecretKey,
        fromAccount: buyer.account,
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

    assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
  });

  it('Only store manager can create dex', () => {
    issue();
    buy();
    setupDex();

    const assetAmount = issuerAddress.getAssetHolding(currentBondIndex)?.amount;

    const groupTx = [
      // call to bond-dapp
      {
        type: types.TransactionType.CallNoOpSSC,
        sign: types.SignType.SecretKey,
        fromAccount: buyer.account,
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

    assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);

    // asset amount is less than required
    groupTx[0].fromAccount = storeManager.account;
    groupTx[1].amount = assetAmount - 100n;
    groupTx[2].amount = assetAmount - 100n;

    assert.throws(() => runtime.executeTx(groupTx), RUNTIME_ERR1009);
  });
});
