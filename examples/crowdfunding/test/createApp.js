import {
  addressToBytes,
  getProgram,
  intToBigEndian,
  stringToBytes
} from '@algorand-builder/algob';
import { Runtime, StoreAccountImpl } from '@algorand-builder/algorand-js/build/src/index'; // fix
import { assert } from 'chai';

// init - create app, update app.
// opt in

// case 1 : donate, claim - fail
// case 2 : donate, donate, claim - pass
// case 3 : donate, reclaim
// case 4 : delete and claim

// task -add delete , add update test
describe('Crowdfunding Tests', function () {
  const creatorAccount = new StoreAccountImpl(1000);
  const escrowAccount = new StoreAccountImpl(0);
  // const donorAccount = new StoreAccountImpl(10000);

  let runtime;
  let program;
  let flags;
  let applicationId;
  this.beforeAll(async function () {
    runtime = new Runtime([creatorAccount]); // setup test more accounts
    program = getProgram('crowdFundApproval.teal');

    flags = {
      sender: creatorAccount.account,
      localInts: 1,
      localBytes: 0,
      globalInts: 5,
      globalBytes: 3
    };
  });

  it('should create crowdfunding application with correct global states', async () => {
    const creationFlags = Object.assign({}, flags);

    // Get begin date to pass in
    const beginDate = new Date();
    beginDate.setSeconds(beginDate.getSeconds() + 2);

    // Get end date to pass in
    const endDate = new Date();
    endDate.setSeconds(endDate.getSeconds() + 12000);

    // Get fund close date to pass in
    const fundCloseDate = new Date();
    fundCloseDate.setSeconds(fundCloseDate.getSeconds() + 120000);

    const appArgs = [
      intToBigEndian(beginDate.getTime()),
      intToBigEndian(endDate.getTime()),
      intToBigEndian(7000000),
      addressToBytes(creatorAccount.account.addr),
      intToBigEndian(fundCloseDate.getTime())
    ];

    const appId = await runtime.addApp({ ...creationFlags, appArgs: appArgs }, {}, program);
    applicationId = appId;
    const creatorPk = addressToBytes(creatorAccount.account.addr);

    // verify global state
    assert.isDefined(appId);
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Creator')), creatorPk);
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('StartDate')), BigInt(beginDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('EndDate')), BigInt(endDate.getTime()));
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Goal')), BigInt(7000000));
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Receiver')), creatorPk);
    assert.deepEqual(runtime.getGlobalState(appId, stringToBytes('Total')), BigInt(0));
  });

  it('should update application with correct escrow account address', async () => {
    const appArgs = [addressToBytes(escrowAccount.account.addr)];

    await runtime.updateApp(
      creatorAccount.account.addr,
      applicationId,
      program,
      {}, { appArgs: appArgs });

    const escrowPk = addressToBytes(escrowAccount.account.addr);

    // verify escrow storage
    assert.isDefined(applicationId);
    assert.deepEqual(runtime.getGlobalState(applicationId, stringToBytes('Escrow')), escrowPk);
  });
});
