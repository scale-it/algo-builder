import algosdk from "algosdk";
import {
  Account,
  ASADef,
  ASADeploymentFlags
} from "../types";

export function makeAssetCreateTxn(asaDesc: ASADef, flags: ASADeploymentFlags, account: Account): string {
  return algosdk.makeAssetCreateTxn(
    account.addr, // from
    1, // fee TODO
    1, // firstRound TODO
    1, // lastRound TODO
    asaDesc.note, // note
    "genesisHash", // genesisHash
    "genesisID", // genesisID
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
    asaDesc.metadataHash // assetMetadataHash
  )
}
