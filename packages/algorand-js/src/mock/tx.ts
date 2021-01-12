import { TxParams } from "@algorand-builder/algob/src/types";
import { SuggestedParams } from "algosdk";

export const ALGORAND_MIN_TX_FEE = 1000;
const GENESIS_ID = 'testnet-v1.0';
// testnet-v1.0 hash
const GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

export function mockSuggestedParams (
  payFlags: TxParams): SuggestedParams {
  const s = {} as SuggestedParams;

  s.flatFee = payFlags.totalFee !== undefined;
  s.fee = payFlags.totalFee ?? payFlags.feePerByte ?? ALGORAND_MIN_TX_FEE;
  if (s.flatFee) s.fee = Math.max(s.fee, ALGORAND_MIN_TX_FEE);

  s.firstRound = payFlags.firstValid ?? 1;
  s.lastRound = payFlags.firstValid === undefined || payFlags.validRounds === undefined
    ? s.firstRound + 1000
    : Number(payFlags.firstValid) + Number(payFlags.validRounds);

  s.genesisID = GENESIS_ID;
  s.genesisHash = GENESIS_HASH;
  return s;
}
