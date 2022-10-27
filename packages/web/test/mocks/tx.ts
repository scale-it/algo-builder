import algosdk, { SuggestedParams } from "algosdk";

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

const johnMne = "found empower message suit siege arrive dad reform museum cake evoke broom comfort fluid flower wheat gasp baby auction tuna sick case camera about flip"
export const senderAccount = {
	addr: "2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA",
	sk: algosdk.mnemonicToSecretKey(johnMne).sk
}
const alicemne = "brand globe reason guess allow wear roof leisure season coin own pen duck worth virus silk jazz pitch behave jazz leisure pave unveil absorb kick"
export const receiverAccount = {
	addr: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
	sk: algosdk.mnemonicToSecretKey(alicemne).sk,
}

const addr = algosdk.decodeAddress(senderAccount.addr);

// MOCK Algorand Encoded Transaction
export const encodedTxnObject: algosdk.EncodedTransaction = {
	snd: Buffer.from(addr.publicKey),
	rcv: Buffer.from(addr.publicKey),
	arcv: Buffer.from(addr.publicKey),
	fee: 1000,
	amt: 20200,
	aamt: 100,
	fv: 258820,
	lv: 259820,
	note: Buffer.from("Note"),
	gen: "default-v1",
	gh: Buffer.from("default-v1"),
	lx: Buffer.from(""),
	aclose: Buffer.from(addr.publicKey),
	close: Buffer.from(addr.publicKey),
	votekey: Buffer.from("voteKey"),
	selkey: Buffer.from("selectionKey"),
	votefst: 123,
	votelst: 345,
	votekd: 1234,
	xaid: 1101,
	caid: 101,
	apar: {
		t: 10,
		dc: 0,
		df: false,
		m: Buffer.from(addr.publicKey),
		r: Buffer.from(addr.publicKey),
		f: Buffer.from(addr.publicKey),
		c: Buffer.from(addr.publicKey),
		un: "tst",
		an: "testcoin",
		au: "testURL",
		am: Buffer.from("test-hash"),
	},
	fadd: Buffer.from(addr.publicKey),
	faid: 202,
	afrz: false,
	apid: 1828,
	apan: 0,
	apap: Buffer.from("approval"),
	apsu: Buffer.from("clear"),
	apaa: [Buffer.from("arg1"), Buffer.from("arg2")],
	apat: [],
	apfa: [1828, 1002, 1003],
	apas: [2001, 2002, 2003],
	type: "pay",
	apls: {
		nui: 1,
		nbs: 2,
	},
	apgs: {
		nui: 3,
		nbs: 4,
	},
	rekey: Buffer.from(addr.publicKey),
	grp: Buffer.from("group"),
	apep: 1,
	nonpart: true,
};

export const mockSuggestedParam: SuggestedParams = {
	flatFee: false,
	fee: 100,
	firstRound: 2,
	lastRound: 100,
	genesisID: "testnet-v1.0",
	genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
};

export const txnReceiptMock = {
	txID: "1",
	"confirmed-round": 1,
	"asset-index": 1,
	"application-index": 1,
	txn: {
		txn: encodedTxnObject,
	}
}