import algosdk from "algosdk";

import {
  ASADef,
  ASADeploymentFlags
} from "../types";

async function getSuggestedParams (algoClient: algosdk.Algodv2): Promise<algosdk.SuggestedParams> {
  const params = await algoClient.getTransactionParams().do();
  // Private chains may have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Suggested params returned 0 as firstRound. Ensure that your node progresses.");
    // params.firstRound = 1
  }
  return params;
}

async function getSuggestedParamsWithUserDefaults(algoClient: algosdk.Algodv2, userDefaults: ASADeploymentFlags): Promise<algosdk.SuggestedParams> {
  const suggested = await getSuggestedParams (algoClient)
  suggested.flatFee = userDefaults.feePerByte === undefined
    ? suggested.flatFee
    : !userDefaults.feePerByte
  suggested.fee = userDefaults.totalFee === undefined
    ? suggested.fee
    : userDefaults.totalFee
  suggested.firstRound = userDefaults.firstValid === undefined
    ? suggested.firstRound
    : userDefaults.firstValid
  suggested.lastRound = userDefaults.firstValid === undefined || userDefaults.validRounds === undefined
    ? suggested.lastRound
    : userDefaults.firstValid + userDefaults.validRounds
  return suggested
}

export async function makeAssetCreateTxn (
  name: string, algoClient: algosdk.Algodv2, asaDef: ASADef, flags: ASADeploymentFlags
): Promise<algosdk.Transaction> {
  // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
  return algosdk.makeAssetCreateTxnWithSuggestedParams(
    flags.creator.addr,
    asaDef.note,
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
    await getSuggestedParamsWithUserDefaults(algoClient, flags)
  );
}
