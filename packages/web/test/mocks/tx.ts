import algosdk, { LogicSigAccount } from "algosdk";
import { testnetURL } from "../../src";
import { algoexplorerAlgod } from "../../src/lib/api";
import { HttpNetworkConfig } from "../../src/types";

const fs = require('fs');
const path = require('path');

export const txObject = {
	name: "Transaction",
	tag: new Uint8Array(0),
	from: {
		publicKey: new Uint8Array(0),
		checksum: new Uint8Array(0),
	},
	note: new Uint8Array(0),
	assetTotal: 10000,
	assetDecimals: 0,
	assetDefaultFrozen: false,
	assetUnitName: "SLV",
	assetName: "silver-1",
	assetURL: "url",
	assetMetadataHash: new Uint8Array(0),
	type: "acfg",
	flatFee: false,
	genesisHash: new Uint8Array(0),
	fee: 267000,
	firstRound: 2,
	lastRound: 100,
	genesisID: "testnet-v1.0",
	appArgs: [],
	lease: new Uint8Array(0),
	group: undefined,
};

const johnMne =
	"found empower message suit siege arrive dad reform museum cake evoke broom comfort fluid flower wheat gasp baby auction tuna sick case camera about flip";
export const senderAccount = {
	addr: "2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA",
	sk: algosdk.mnemonicToSecretKey(johnMne).sk,
};
const alicemne =
	"brand globe reason guess allow wear roof leisure season coin own pen duck worth virus silk jazz pitch behave jazz leisure pave unveil absorb kick";
export const receiverAccount = {
	addr: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
	sk: algosdk.mnemonicToSecretKey(alicemne).sk,
};

export async function createLsigAccount(): Promise<LogicSigAccount> {
	const walletURL: HttpNetworkConfig = {
		token: "",
		server: testnetURL,
		port: "",
	};
	const algodClient: algosdk.Algodv2 = algoexplorerAlgod(walletURL);
	const data = fs.readFileSync(path.join(__dirname, 'sample.teal'));
	const results = await algodClient.compile(data).do();
	return new LogicSigAccount(new Uint8Array(Buffer.from(results.result, "base64")));
}