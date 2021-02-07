import { AssetDef, AssetHolding } from "algosdk";

import { stringToBytes } from "../../src/lib/parsing";
import { AppLocalStateM, SSCAttributesM, StackElem } from "../../src/types";
import { elonAddr } from "./txn";

const convertToKey = (str: string): string => { return stringToBytes(str).toString(); };

const appLocalState = new Map<number, AppLocalStateM>();
const createdApps = new Map<number, SSCAttributesM>();
const createdAssets = new Map<number, AssetDef>();

const assets = new Map<number, AssetHolding>();
assets.set(3, { 'asset-id': 3, amount: 2, creator: "string", 'is-frozen': false });
assets.set(32, { 'asset-id': 32, amount: 2, creator: "AS", 'is-frozen': false });

const globalStateMap = new Map<string, StackElem>();
globalStateMap.set(convertToKey('Hello'), stringToBytes('World'));
globalStateMap.set(convertToKey('global-key'), stringToBytes('global-val'));

const localStateMap = new Map<string, StackElem>();
localStateMap.set(convertToKey('Local-key'), stringToBytes('Local-val'));

export const accInfo = [{
  address: "addr-1",
  assets: assets,
  amount: 123,
  appsLocalState: appLocalState.set(1847, {
    id: 1847,
    'key-value': localStateMap,
    schema: {
      'num-byte-slice': 2,
      'num-uint': 1
    }
  }),
  appsTotalSchema: { 'num-byte-slice': 583, 'num-uint': 105 },
  createdApps: createdApps.set(1828, {
    'approval-program': '',
    'clear-state-program': '',
    creator: elonAddr,
    'global-state': globalStateMap,
    'global-state-schema': { 'num-byte-slice': 3, 'num-uint': 1 },
    'local-state-schema': { 'num-byte-slice': 0, 'num-uint': 16 }
  }),
  createdAssets: createdAssets.set(3, {
    creator: "addr-1",
    total: 10000,
    decimals: 10,
    'default-frozen': false,
    'unit-name': "AD",
    name: "ASSETAD",
    url: "assetUrl",
    'metadata-hash': "hash",
    manager: "addr-1",
    reserve: "addr-2",
    freeze: "addr-3",
    clawback: "addr-4"
  })
}];
