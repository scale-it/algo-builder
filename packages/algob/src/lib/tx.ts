import tx from "algosdk";
import { TextEncoder } from "util";

import {
  ASADef,
  ASADeploymentFlags,
  TxParams
} from "../types";
import { ALGORAND_MIN_TX_FEE } from "./algo-operator";

async function getSuggestedParams (algocl: tx.Algodv2): Promise<tx.SuggestedParams> {
  const params = await algocl.getTransactionParams().do();
  // Private chains may have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Suggested params returned 0 as firstRound. Ensure that your node progresses.");
    // params.firstRound = 1
  }
  return params;
}

export async function mkSuggestedParams (
  algocl: tx.Algodv2, userDefaults: TxParams): Promise<tx.SuggestedParams> {
  const s = await getSuggestedParams(algocl);

  s.flatFee = userDefaults.totalFee !== undefined;
  s.fee = userDefaults.totalFee ?? userDefaults.feePerByte ?? ALGORAND_MIN_TX_FEE;
  if (s.flatFee) s.fee = Math.max(s.fee, ALGORAND_MIN_TX_FEE);

  s.firstRound = userDefaults.firstValid ?? s.firstRound;
  s.lastRound = userDefaults.firstValid === undefined || userDefaults.validRounds === undefined
    ? s.lastRound
    : userDefaults.firstValid + userDefaults.validRounds;
  return s;
}

export async function makeAssetCreateTxn (
  name: string, algocl: tx.Algodv2, asaDef: ASADef, flags: ASADeploymentFlags
): Promise<tx.Transaction> {
  const encoder = new TextEncoder();
  // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
  return tx.makeAssetCreateTxnWithSuggestedParams(
    flags.creator.addr,
    asaDef.note ? encoder.encode(asaDef.note) : undefined,
    asaDef.total,
    asaDef.decimals,
    asaDef.defaultFrozen,
    asaDef.manager,
    asaDef.reserve,
    asaDef.freeze,
    asaDef.clawback,
    asaDef.unitName,
    name,
    asaDef.url,
    asaDef.metadataHash,
    await mkSuggestedParams(algocl, flags)
  );
}
