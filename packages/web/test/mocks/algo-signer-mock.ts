/* eslint-disable sonarjs/no-identical-functions */
import { unknown } from "zod";

import {
	AlgoSigner,
	Encoding,
	JsonPayload,
	MultisigTransaction,
	RequestErrors,
	Transaction,
	WalletTransaction,
} from "../../src/algo-signer-types";

const suggestedParamsMock = {
	flatFee: false,
	"min-fee": 100,
	"first-round": 2,
	"last-round": 100,
	"genesis-id": "testnet-v1.0",
	"genesis-hash": "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
};

class EncodingMock implements Encoding {
	base64ToMsgpack(txn: string): Uint8Array {
		return new Uint8Array([]);
	}
	msgpackToBase64(txn: Uint8Array): string {
		return "";
	}
}

export class AlgoSignerMock implements AlgoSigner {
	encoding: Encoding;

	constructor() {
		this.encoding = new EncodingMock();
	}
	accounts(params: JsonPayload, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}

	algod(params: JsonPayload, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise<JsonPayload>((resolve, reject) => {
			if (params["path"] === "/v2/transactions/params") {
				resolve(suggestedParamsMock as unknown as JsonPayload);
			}
			resolve({});
		});
	}
	indexer(params: JsonPayload, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}
	send(params: any, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}

	sign(params: Transaction, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}

	signTxn(transactions: WalletTransaction[], error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}

	signMultisig(params: MultisigTransaction, error?: RequestErrors): Promise<JsonPayload> {
		return new Promise((resolve, reject) => {
			return resolve({});
		});
	}
}
