import { TxParams } from "algob/src/types";
import { decodeAddress, generateAccount, SuggestedParams } from "algosdk";

import { toBytes } from "../../src/lib/parse-data";

const ALGORAND_MIN_TX_FEE = 1000;
const GENESIS_ID = 'testnet-v1.0';
// testnet-v1.0 hash
const GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

const account = generateAccount();
const addr = decodeAddress(account.addr);

export const TXN_OBJ = {
  from: addr,
  to: addr,
  fee: 1000,
  amount: 100,
  firstRound: 258820,
  lastRound: 259820,
  note: toBytes("Note"),
  genesisID: 'default-v1',
  genesisHash: Buffer.from('default-v1'),
  lease: new Uint8Array(0),
  closeRemainderTo: addr,
  voteKey: Buffer.from("voteKey"),
  selectionKey: Buffer.from("selectionKey"),
  voteFirst: 123,
  voteLast: 345,
  voteKeyDilution: 1234,
  assetIndex: 1101,
  assetTotal: 10,
  assetDecimals: 0,
  assetDefaultFrozen: true,
  assetManager: addr,
  assetReserve: addr,
  assetFreeze: addr,
  assetClawback: addr,
  assetUnitName: 'tst',
  assetName: 'testcoin',
  assetURL: 'testURL',
  assetMetadataHash: Buffer.from('test-hash'),
  freezeAccount: addr,
  freezeState: true,
  assetRevocationTarget: addr,
  appIndex: 1201,
  appOnComplete: 0,
  appLocalInts: 2,
  appLocalByteSlices: 2,
  appGlobalInts: 2,
  appGlobalByteSlices: 2,
  appApprovalProgram: toBytes("approval"),
  appClearProgram: toBytes("clear"),
  appArgs: ["arg1", "arg2"].map(toBytes),
  appAccounts: [addr, addr],
  appForeignApps: [1001, 1002, 1003],
  appForeignAssets: [2001, 2002, 2003],
  type: 'pay',
  reKeyTo: addr,
  group: Buffer.from('group')
};

export function mockSuggestedParams (
  payFlags: TxParams): SuggestedParams {
  const s = {} as SuggestedParams;

  s.flatFee = payFlags.totalFee !== undefined;
  s.fee = payFlags.totalFee ?? payFlags.feePerByte ?? ALGORAND_MIN_TX_FEE;
  if (s.flatFee) s.fee = Math.max(s.fee, ALGORAND_MIN_TX_FEE);

  s.firstRound = payFlags.firstValid ?? 1;
  s.lastRound = payFlags.firstValid === undefined || payFlags.validRounds === undefined
    ? s.firstRound + 1000
    : payFlags.firstValid + payFlags.validRounds;

  s.genesisID = GENESIS_ID;
  s.genesisHash = GENESIS_HASH;
  return s;
}
