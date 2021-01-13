import { AssetDef } from "algosdk";

import { stringToBytes } from "../../src/lib/parsing";
import { AppLocalStateM, SSCAttributesM, StackElem } from "../../src/types";

const byteToStr = (str: string): string => { return stringToBytes(str).toString(); };

const appLocalState = new Map<number, AppLocalStateM>();
const createdApps = new Map<number, SSCAttributesM>();
const createdAssets = new Map<number, AssetDef>();

const globalKeyVal = new Map<string, StackElem>();
globalKeyVal.set(byteToStr('Hello'), stringToBytes('World'));
globalKeyVal.set(byteToStr('global-key'), stringToBytes('global-val'));

const localKeyVal = new Map<string, StackElem>();
localKeyVal.set(byteToStr('Local-key'), stringToBytes('Local-val'));

export const accInfo = [{
  address: "addr-1",
  assets: [
    { 'asset-id': 3, amount: 2, creator: "string", 'is-frozen': "false" },
    { 'asset-id': 32, amount: 2, creator: "AS", 'is-frozen': "false" }
  ],
  amount: 123,
  appsLocalState: appLocalState.set(1847, {
    id: 1847,
    'key-value': localKeyVal,
    schema: {
      'num-byte-slice': 2,
      'num-uint': 1
    }
  }),
  appsTotalSchema: { 'num-byte-slice': 583, 'num-uint': 105 },
  createdApps: createdApps.set(1828, {
    'approval-program': '',
    'clear-state-program': '',
    creator: "addr-1",
    'global-state': globalKeyVal,
    'global-state-schema': { 'num-byte-slice': 3, 'num-uint': 1 },
    'local-state-schema': { 'num-byte-slice': 0, 'num-uint': 16 }
  }),
  createdAssets: createdAssets.set(3, {
    creator: "addr-1",
    total: 10000,
    decimals: 10,
    'default-frozen': "false",
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
