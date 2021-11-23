import algosdk, { Algodv2, ALGORAND_MIN_TX_FEE, SuggestedParams } from "algosdk";

import { ChainType, TxParams } from "../types";

const mainNetClient = new Algodv2("", "https://algoexplorerapi.io", "");
const testNetClient = new Algodv2("", "https://testnet.algoexplorerapi.io", "");

export function clientForChain (chain: ChainType): algosdk.Algodv2 {
  switch (chain) {
    case ChainType.MainNet:
      return mainNetClient;
    case ChainType.TestNet:
      return testNetClient;
    default:
      throw new Error(`Unknown chain type: ${chain as string}`);
  }
}

/**
 * Returns blockchain transaction suggested parameters (firstRound, lastRound, fee..)
 * @param algocl an Algorand client, instance of Algodv2, used to communicate with a blockchain node.
 */
export async function getSuggestedParams (algocl: Algodv2): Promise<SuggestedParams> {
  const params = await algocl.getTransactionParams().do();
  // Private chains may have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Suggested params returned 0 as firstRound. Ensure that your node progresses.");
    // params.firstRound = 1
  }
  return params;
}

/**
 * Returns a union object of custom transaction params and suggested params.
 * @param algocl an Algorand client, instance of Algodv2, used to communicate with a blockchain node.
 * @param userParams a dict containing custom params defined by the user
 * @param s suggested transaction params
 */
export async function mkTxParams (
  algocl: Algodv2, userParams: TxParams, s?: SuggestedParams): Promise<SuggestedParams> {
  if (s === undefined) { s = await getSuggestedParams(algocl); }

  if (userParams.flatFee === undefined) {
    if (userParams.totalFee !== undefined) s.flatFee = true;
    else s.flatFee = false;
  }
  s.fee = userParams.totalFee ?? userParams.feePerByte ?? ALGORAND_MIN_TX_FEE;

  s.firstRound = userParams.firstValid ?? s.firstRound;
  s.lastRound = userParams.firstValid === undefined || userParams.validRounds === undefined
    ? s.lastRound
    : Number(userParams.firstValid) + Number(userParams.validRounds);
  return s;
}
