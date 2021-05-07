import { RUNTIME_ERRORS } from '../../build/errors/errors-list';
import { AccountStore, Runtime } from '../../src/index';
import { SignType, TransactionType } from '../../src/types';
import { useFixture } from '../helpers/integration';
import { expectRuntimeError } from '../helpers/runtime-errors';
const {
  getProgram
} = require('@algo-builder/algob');

const minBalance = 10e6; // 10 ALGO's
const initialCreatorBalance = minBalance + 0.01e6;

describe('Current Transaction Tests', function () {
  useFixture('group-index');

  let runtime;
  let flags;
  let master, creator;
  let applicationId1, applicationId2;
  let approvalProgram, clearProgram;

  this.beforeEach(async function () {
    master = new AccountStore(1000e6);
    creator = new AccountStore(initialCreatorBalance);

    runtime = new Runtime([master, creator]);
    approvalProgram = getProgram('test1.py');
    clearProgram = getProgram('clear.teal');

    flags = {
      sender: creator.account,
      localInts: 0,
      localBytes: 0,
      globalInts: 0,
      globalBytes: 0
    };
  });

  function setupApps () {
    const creationFlags = Object.assign({}, flags);

    // create first application
    applicationId1 = runtime.addApp(
      { ...creationFlags }, {}, approvalProgram, clearProgram);

    // create second application
    applicationId2 = runtime.addApp(
      { ...creationFlags }, {}, getProgram('test2.py'), clearProgram);
  }

  it('Group Index Check', () => {
    setupApps();

    const txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId1,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId2,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(txGroup);
  });

  it('Failure test for group index', () => {
    setupApps();

    const txGroup = [
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId2,
        payFlags: { totalFee: 1000 }
      },
      {
        type: TransactionType.CallNoOpSSC,
        sign: SignType.SecretKey,
        fromAccount: creator.account,
        appId: applicationId1,
        payFlags: { totalFee: 1000 }
      }
    ];

    // Fails because groupindex don't match
    expectRuntimeError(
      () => runtime.executeTx(txGroup),
      RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC
    );
  });
});
