import { types } from "@algo-builder/web";

import { RUNTIME_ERRORS } from "../../src/errors/errors-list";
import { AccountStore, Runtime } from '../../src/index';
import { useFixture } from '../helpers/integration';
import { expectRuntimeError } from '../helpers/runtime-errors';

const minBalance = 10e6; // 10 ALGO's
const initialCreatorBalance = minBalance + 0.01e6;

describe('Current Transaction Tests', function () {
  useFixture('group-index');

  let runtime: Runtime;
  let master: AccountStore, creator: AccountStore;
  let applicationId1: number, applicationId2: number;
  let approvalProgramFileName: string, clearProgramFileName: string;

  const flags = {
    localInts: 0,
    localBytes: 0,
    globalInts: 0,
    globalBytes: 0
  };

  this.beforeEach(async function () {
    master = new AccountStore(1000e6);
    creator = new AccountStore(initialCreatorBalance);

    runtime = new Runtime([master, creator]);
    approvalProgramFileName = 'test1.teal';
    clearProgramFileName = 'clear.teal';
  });

  function setupApps (): void {
    const creationFlags = Object.assign({}, flags);

    // deploy first application
    applicationId1 = runtime.deployApp(
      approvalProgramFileName,
      clearProgramFileName,
      { ...creationFlags, sender: creator.account },
      {}
    ).appID;

    // deploy second application
    applicationId2 = runtime.deployApp(
      'test2.teal',
      clearProgramFileName,
      { ...creationFlags, sender: creator.account },
      {}
    ).appID;
  }

  it('Group Index Check', () => {
    setupApps();

    const txGroup: types.ExecParams[] = [
      {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appID: applicationId1,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appID: applicationId2,
        payFlags: { totalFee: 1000 }
      }
    ];

    runtime.executeTx(txGroup);
  });

  it('Failure test for group index', () => {
    setupApps();

    const txGroup: types.ExecParams[] = [
      {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appID: applicationId2,
        payFlags: { totalFee: 1000 }
      },
      {
        type: types.TransactionType.CallApp,
        sign: types.SignType.SecretKey,
        fromAccount: creator.account,
        appID: applicationId1,
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
