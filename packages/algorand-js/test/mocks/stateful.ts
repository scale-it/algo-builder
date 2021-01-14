import { AppLocalState } from "algosdk";

import { stringToBytes } from "../../src/lib/parsing";

const appLocalState = new Map<number, AppLocalState>();
export const accInfo = [{
  address: "addr-1",
  assets: [
    { 'asset-id': 3, amount: 2, creator: "string", 'is-frozen': "false" },
    { 'asset-id': 32, amount: 2, creator: "AS", 'is-frozen': "false" }
  ],
  amount: 123,
  appsLocalState: appLocalState.set(1847, {
    id: 1847,
    'key-value': [
      {
        key: stringToBytes("Local-key"),
        value: {
          bytes: stringToBytes("Local-val"),
          type: 1,
          uint: 0
        }
      }
    ],
    schema: {
      'num-byte-slice': 2,
      'num-uint': 1
    }
  }),
  appsTotalSchema: { 'num-byte-slice': 583, 'num-uint': 105 },
  createdApps: [{
    id: 1828,
    attributes: {
      'approval-program': '',
      'clear-state-program': '',
      creator: "addr-1",
      'global-state': [
        {
          key: stringToBytes("Hello"),
          value: {
            bytes: stringToBytes("World"),
            type: 1,
            uint: 0
          }
        },
        {
          key: stringToBytes("global-key"),
          value: {
            bytes: stringToBytes("global-val"),
            type: 1,
            uint: 0
          }
        }
      ],
      'global-state-schema': { 'num-byte-slice': 3, 'num-uint': 1 },
      'local-state-schema': { 'num-byte-slice': 0, 'num-uint': 16 }
    }
  }],
  'created-assets': [{
    index: 3,
    attributes: {
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
    }
  }]
}];
