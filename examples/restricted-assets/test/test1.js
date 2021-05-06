import {
  addressToPk,
  getProgram
} from '@algo-builder/algob';
import { AccountStore, Runtime, stringToBytes, types } from '@algo-builder/runtime';
import { assert } from 'chai';

const minBalance = 10e6; // 10 ALGO's
const aliceAddr = 'EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY';
const bobAddr = '2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ';
const ACCRED_LEVEL = 'Accred-Level';

describe('Test for transferring asset using custom logic', function () {
  let escrow; // initialized later (using runtime.getLogicSig)

  let runtime;
  let creationFlags;
  let applicationId;
  let assetId;
  let assetDef;
  const approvalProgram = getProgram('test.teal');
  const clearProgram = getProgram('poi-clear.teal');

  // Update account state
  function syncAccounts () {
    alice = runtime.getAccount(alice.address);
    bob = runtime.getAccount(bob.address);
    if (escrow) { escrow = runtime.getAccount(escrow.address); }
  }

  it('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', () => {
const master = new AccountStore(1000e6);
const alice = new AccountStore(minBalance, { addr: aliceAddr, sk: new Uint8Array(0) });
const bob = new AccountStore(minBalance, { addr: bobAddr, sk: new Uint8Array(0) });
const runtime = new Runtime([master, alice, bob]);

creationFlags = {
  sender: alice.account,
  localInts: 1,
  localBytes: 0,
  globalInts: 2,
  globalBytes: 1
};

assetId = runtime.addAsset('gold', { creator: { ...alice.account, name: 'alice' } });

applicationId = runtime.addApp(
  { ...creationFlags, appArgs: [`int:${assetId}`] }, {}, approvalProgram, clearProgram);

runtime.optInToApp(alice.address, applicationId, {}, {});
runtime.optInToApp(bob.address, applicationId, {}, {});

    const globalState = runtime.getApp(applicationId)['global-state'];
    const toString = (u) => { return Buffer.from(u).toString(); }

    for (const [key, value] of globalState.entries()){
      const keyasByte = new Uint8Array(key.split(',').map(Number));
      console.log('kaB ', keyasByte)
      console.log('key ', toString(keyasByte));
      console.log('value ', value);
    }

    const arr = new Uint8Array([
      0,
        0,   0,   0,   0,  0, 0,
        1
    ])


    console.log('toooo ', stringToBytes('test_1'));
    // const deploySSCParams = {
    //   type: types.TransactionType.CallNoOpSSC,
    //   sign: types.SignType.SecretKey,
    //   fromAccount: fromAccount,
    //   appId: applicationId,
    //   appArgs: [`int:${assetId}`],
    //   payFlags: { totalFee: 1000 }
    // }
  })
});
