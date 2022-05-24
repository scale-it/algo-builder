import {
	Algodv2,
	getApplicationAddress,
	LogicSigAccount,
	modelsv2,
	SuggestedParams,
} from "algosdk";

import { ConfirmedTxInfo } from "../../src/types";
import { bobAcc } from "./account";

export const mockAlgod = new Algodv2("dummyToken", "https://dummyNetwork", 8080);

export const MOCK_APPLICATION_ADDRESS = getApplicationAddress(1);

export const mockGenesisInfo: any = {
	alloc: [
		{
			addr: "7777777777777777777777777777777777777777777777777774MSJUVU",
			comment: "RewardsPool",
			state: [],
		},
	],
	// devmode: true,
	fees: "A7NMWS3NT3IUDMLVO26ULGXGIIOUQ3ND2TXSER6EBGRZNOBOUIQXHIBGDE",
	id: "v1",
	network: "private",
	proto:
		"https://github.com/algorandfoundation/specs/tree/bc36005dbd776e6d1eaf0c560619bb183215645c",
	rwd: "7777777777777777777777777777777777777777777777777774MSJUVU",
};

export const mockSuggestedParam: SuggestedParams = {
	flatFee: false,
	fee: 100,
	firstRound: 2,
	lastRound: 100,
	genesisID: "testnet-v1.0",
	genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
};

export const mockConfirmedTx: ConfirmedTxInfo = {
	"confirmed-round": 1,
	"asset-index": 1,
	"application-index": 1,
	"global-state-delta": "string",
	"local-state-delta": "string",
};

export const mockAssetInfo: modelsv2.Asset = {
	index: 1,
	params: {
		creator: "addr-1",
		total: 1000,
		decimals: 8,
		defaultFrozen: false,
		unitName: "TKN",
		name: "ASA-1",
		url: "link",
		metadataHash: new Uint8Array(0),
		manager: bobAcc.addr,
		reserve: undefined,
		freeze: bobAcc.addr,
		clawback: undefined,
	} as modelsv2.AssetParams,
} as modelsv2.Asset;

const mockProgram = new Uint8Array([
	2, 32, 4, 1, 4, 100, 144, 78, 49, 16, 34, 18, 49, 16, 35, 18, 17, 49, 8, 36, 14, 16, 49, 18,
	36, 14, 16, 49, 32, 50, 3, 18, 16, 49, 9, 50, 3, 18, 16, 49, 1, 37, 14, 16,
]);

export const mockDryRunResponse = {
	error: "",
	"protocol-version":
		"https://github.com/algorandfoundation/specs/tree/65b4ab3266c52c56a0fa7d591754887d68faad0a",
	txns: [
		{
			disassembly: [
				"#pragma version 4",
				"intcblock 1 0 4 1000 10000",
				"bytecblock 0x20ee6e18c121cab6dfc0f94d3d97d9dce06453d6ad52d75cd85d5b35d86e1112",
				"global GroupSize",
				"intc_0 // 1",
			],
			"logic-sig-messages": ["PASS"],
			"logic-sig-trace": [
				{
					line: 41,
					pc: 96,
					stack: [
						{
							bytes: "",
							type: 2,
							uint: 1,
						},
						{
							bytes: "",
							type: 2,
							uint: 1,
						},
					],
				},
			],
		},
	],
};

export const mockAccountInformation = {
	address: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
	amount: 196868961,
	"amount-without-pending-rewards": 196867197,
	"apps-local-state": [{ id: 6, "key-value": [], schema: [] }],
	"apps-total-schema": { "num-byte-slice": 1, "num-uint": 3 },
	assets: [
		{
			amount: 1000000,
			"asset-id": 4,
			creator: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
			"is-frozen": false,
		},
	],
	"created-apps": [{ id: 6, params: [] }],
	"created-assets": [{ index: 4, params: [] }],
	"pending-rewards": 1764,
	"reward-base": 10,
	rewards: 1961,
	round: 412,
	status: "Offline",
};

export const mockApplicationResponse = {
	id: 6,
	params: {
		"approval-program":
			"AiAHAAIBBAUDBiYHB0NyZWF0b3IHQXNzZXRJRApBc3NldExldmVsCXNldC1sZXZlbAVjbGVhcgtjaGVjay1sZXZlbAxBY2NyZWQtTGV2ZWwiMRgSQQAZMRsjEkEBbSgxAGcpNhoAF2cqNhoBF2ckQzEZIhJAACAxGSQSQAEzMRkjEkABOjEZJRJAATwxGSEEEkABNUIBNDEbJA8xGyMOEEEBKDYaACsSQAATNhoAJwQSQAAmNhoAJwUSQAA1ADEbIxIoZDEAEhAyBCQSEEEA+yQnBjYaARdmJEMxGyQSKGQxABIQMgQkEhBBAN8kJwZoJEMyBCEFEjMAECEGEhAzARAlEhAzAhAkEhAxFiISEEEAuTMAIDIDEjMBIDIDEhAzAiAyAxIQMwAJMgMSEDMBCTIDEhAzAgkyAxIQMwAVMgMSEDMBFTIDEhAzAhUyAxIQQQB4IillQQByNQszABgyCBIzAAAzAgASEDMAADMBExIQQQBXNwAcATMBFBIzARE0CxIQQQBFMwIIMwEBD0EAOyIzABgnBmNBADEqZA9BACskMRgnBmNBACIqZA9BABwkQzEbIhIxFiISEEEADiRDMRYiEkEABSRDACRDIkM=",
		"clear-state-program": "AiABASJD",
		creator: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
		"global-state": [],
		"global-state-schema": { "num-byte-slice": 1, "num-uint": 2 },
		"local-state-schema": { "num-byte-slice": 0, "num-uint": 1 },
	},
};

export const mockPendingTransactionInformation = {
	"confirmed-round": 1,
	"asset-index": 1,
	"application-index": 1,
	"global-state-delta": "string",
	"local-state-delta": "string",
};

export const mockLsig: LogicSigAccount = new LogicSigAccount(mockProgram, []);
