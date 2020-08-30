import algosdk from "algosdk";

import {
  ASCDeploymentFlags
} from "../types";

async function getSuggestedParams (algocl: algosdk.Algodv2): Promise<algosdk.SuggestedParams> {
  const params = await algocl.getTransactionParams().do();
  // Private chains may have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Suggested params returned 0 as firstRound. Ensure that your node progresses.");
    // params.firstRound = 1
  }
  return params;
}

export async function getSuggestedParamsWithUserDefaults (
  algocl: algosdk.Algodv2, userDefaults: ASCDeploymentFlags): Promise<algosdk.SuggestedParams> {
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
