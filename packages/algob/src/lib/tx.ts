import algosdk from "algosdk";
import {
  Account,
  ASADef,
  ASADeploymentFlags
} from "../types";

async function produceSuggestedParams(algoClient: algosdk.Algodv2): Promise<algosdk.SuggestedParams> {
  let params = await algoClient.getTransactionParams().do();
  // Private chains have an issue with firstRound
  if (params.firstRound === 0) {
    throw new Error("Ensure that your config points to a node and not to a whole network.")
    //params.firstRound = 1
  }
  return params
}

export async function makeAssetCreateTxn(algoClient: algosdk.Algodv2, asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): Promise<algosdk.Transaction> {
  // https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L104
  return algosdk.makeAssetCreateTxnWithSuggestedParams(
    account.addr, // from
    asaDesc.note, // note
    asaDesc.total, // total
    asaDesc.decimals, // decimals
    asaDesc.defaultFrozen, // defaultFrozen
    asaDesc.manager, // manager
    asaDesc.reserve, // reserve
    asaDesc.freeze, // freeze
    asaDesc.clawback, // clawback
    asaDesc.unitName, // unitName
    asaDesc.unitName, // assetName
    asaDesc.url, // assetURL
    asaDesc.metadataHash, // assetMetadataHash
    await produceSuggestedParams(algoClient)
  )
}
