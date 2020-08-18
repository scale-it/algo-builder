import tx from "algosdk";
import { TextEncoder } from "util";

import {
  ASADef,
  ASADeploymentFlags
} from "../types";

async function getSuggestedParams (algocl: tx.Algodv2): Promise<tx.SuggestedParams> {
  const params = await algocl.getTransactionParams().do();
  // Private chains may have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Suggested params returned 0 as firstRound. Ensure that your node progresses.");
    // params.firstRound = 1
  }
  return params;
}

async function getSuggestedParamsWithUserDefaults (
  algocl: tx.Algodv2, userDefaults: ASADeploymentFlags): Promise<tx.SuggestedParams> {
  const suggested = await getSuggestedParams(algocl);
  suggested.flatFee = userDefaults.feePerByte === undefined
    ? suggested.flatFee
    : !userDefaults.feePerByte;
  suggested.fee = userDefaults.totalFee === undefined
    ? suggested.fee
    : userDefaults.totalFee;
  suggested.firstRound = userDefaults.firstValid === undefined
    ? suggested.firstRound
    : userDefaults.firstValid;
  suggested.lastRound = userDefaults.firstValid === undefined || userDefaults.validRounds === undefined
    ? suggested.lastRound
    : userDefaults.firstValid + userDefaults.validRounds;
  return suggested;
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
    await getSuggestedParamsWithUserDefaults(algocl, flags)
  );
}
