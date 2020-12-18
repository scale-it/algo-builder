import { TxParams } from "algob/src/types";
import { decodeAddress, generateAccount, SuggestedParams } from "algosdk";

const ALGORAND_MIN_TX_FEE = 1000;
const GENESIS_ID = 'testnet-v1.0';
// testnet-v1.0 hash
const GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

const account = generateAccount();
const addr = decodeAddress(account.addr);

export const TXN_OBJ = {
  snd: Buffer.from(addr.publicKey),
  rcv: Buffer.from(addr.publicKey),
  asnd: Buffer.from(addr.publicKey),
  arcv: Buffer.from(addr.publicKey),
  fee: 1000,
  amt: 20200,
  aamt: 100,
  fv: 258820,
  lv: 259820,
  note: Buffer.from("Note"),
  gen: 'default-v1',
  gh: Buffer.from('default-v1'),
  lx: Buffer.from(""),
  aclose: Buffer.from(addr.publicKey),
  close: Buffer.from(addr.publicKey),
  votekey: Buffer.from("voteKey"),
  selkey: Buffer.from("selectionKey"),
  votefst: 123,
  votelst: 345,
  votekd: 1234,
  xaid: 1101,
  caid: 101,
  apar: {
    t: 10,
    dc: 0,
    df: 1,
    m: Buffer.from(addr.publicKey),
    r: Buffer.from(addr.publicKey),
    f: Buffer.from(addr.publicKey),
    c: Buffer.from(addr.publicKey),
    un: 'tst',
    an: 'testcoin',
    au: 'testURL',
    am: Buffer.from('test-hash')
  },
  fadd: Buffer.from(addr.publicKey),
  faid: 202,
  afrz: false,
  apid: 1201,
  apan: 0,
  apap: Buffer.from("approval"),
  apsu: Buffer.from("clear"),
  apaa: [Buffer.from("arg1"), Buffer.from("arg2")],
  apat: [Buffer.from("addr-2"), Buffer.from("addr-2")],
  apfa: [1001, 1002, 1003],
  apas: [2001, 2002, 2003],
  type: 'pay',
  apls: {
    nui: 2,
    nbs: 2
  },
  apgs: {
    nui: 2,
    nbs: 2
  },
  txID: 'transaction-id',
  rekey: Buffer.from(addr.publicKey),
  grp: Buffer.from('group')
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
