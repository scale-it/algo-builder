import { toBytes } from "algob";

export const accInfo = [{
  address: "addr-1",
  assets: [],
  amount: 123,
  appsLocalState: [{
    id: 1847,
    'key-value': [
      {
        key: toBytes("Local-key"),
        value: {
          bytes: toBytes("Local-val"),
          type: 1,
          uint: 0
        }
      }
    ],
    schema: {
      'num-byte-slice': 2,
      'num-uint': 1
    }
  }],
  appsTotalSchema: { 'num-byte-slice': 583, 'num-uint': 105 },
  createdApps: [{
    id: 1828,
    params: {
      'approval-program': '',
      'clear-state-program': '',
      creator: "addr-1",
      'global-state': [
        {
          key: toBytes("Hello"),
          value: {
            bytes: toBytes("World"),
            type: 1,
            uint: 0
          }
        },
        {
          key: toBytes("global-key"),
          value: {
            bytes: toBytes("global-val"),
            type: 1,
            uint: 0
          }
        }
      ],
      'global-state-schema': { 'num-byte-slice': 3, 'num-uint': 1 },
      'local-state-schema': { 'num-byte-slice': 0, 'num-uint': 16 }
    }
  }],
  createdAssets: []
}];
