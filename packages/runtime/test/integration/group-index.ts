import { RUNTIME_ERRORS } from '../../build/errors/errors-list';
import { AccountStore, Runtime } from '../../src/index';
import { ExecParams, SignType, TransactionType } from '../../src/types';
import { getProgram } from "../helpers/files";
import { useFixture } from '../helpers/integration';
import { expectRuntimeError } from '../helpers/runtime-errors';

const minBalance = 10e6; // 10 ALGO's
const initialCreatorBalance = minBalance + 0.01e6;

describe('Current Transaction Tests', function () {
  useFixture('group-index');

  let runtime: Runtime;
  let master: AccountStore, creator: AccountStore;
  let applicationId1: number, applicationId2: number;
  let approvalProgram: string, clearProgram: string;

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
    approvalProgram = getProgram('test1.teal');
    clearProgram = getProgram('clear.teal');
  });

  function setupApps (): void {
    const creationFlags = Object.assign({}, flags);

    // create first application
    applicationId1 = runtime.addApp(
      { ...creationFlags, sender: creator.account }, {}, approvalProgram, clearProgram);

    // create second application
    applicationId2 = runtime.addApp(
      { ...creationFlags, sender: creator.account }, {}, getProgram('test2.teal'), clearProgram);
  }

  it('Group Index Check', () => {
    setupApps();

    const txGroup: ExecParams[] = [
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

    const txGroup: ExecParams[] = [
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
