import { types as rtypes } from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";
import algosdk, { Account, Algodv2, LogicSigAccount, modelsv2, Transaction } from "algosdk";

import { txWriter } from "../../src/internal/tx-log-writer";
import { AlgoOperator } from "../../src/lib/algo-operator";
import { ASCCache, ConfirmedTxInfo, FundASCFlags, LsigInfo, SCParams } from "../../src/types";
import {
	MOCK_APPLICATION_ADDRESS,
	mockAlgod,
	mockAssetInfo,
	mockConfirmedTx,
	mockPendingTransactionInformation,
} from "../mocks/tx";

export class AlgoOperatorDryRunImpl implements AlgoOperator {
	get algodClient(): Algodv2 {
		return mockAlgod;
	}

	getAssetByID(assetIndex: number | bigint): Promise<modelsv2.Asset> {
		return new Promise((resolve, reject) => {
			assetIndex === 1n ? resolve(mockAssetInfo) : reject(new Error("Not implemented"));
		});
	}

	sendAndWait(rawTxns: Uint8Array | Uint8Array[]): Promise<ConfirmedTxInfo> {
		return new Promise((resolve, _reject) => {
			resolve(mockConfirmedTx);
		});
	}

	waitForConfirmation(_txID: string): Promise<ConfirmedTxInfo> {
		return this.sendAndWait([]);
	}

	getReceiptTxns(txns: Transaction[]): Promise<ConfirmedTxInfo[]> {
		return new Promise((resolve, rejects) => {
			resolve([mockPendingTransactionInformation]);
		});
	}

	async deployASA(
		name: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags,
		accounts: rtypes.AccountMap,
		txnWriter: txWriter
	): Promise<rtypes.ASAInfo> {
		return {
			creator: String(flags.creator.addr) + "-get-address-dry-run",
			txID: "tx-id-dry-run",
			assetIndex: 1,
			confirmedRound: -1,
			assetDef: asaDef,
			deleted: false,
		};
	}

	async fundLsig(
		lsig: LogicSigAccount | string,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams,
		txnWriter: txWriter,
		scInitParam?: unknown
	): Promise<LsigInfo> {
		return {
			creator: String(flags.funder.addr) + "-get-address-dry-run",
			contractAddress: "dfssdfsd",
			lsig: {} as LogicSigAccount,
		};
	}

	async deployApp(
		creator: algosdk.Account,
		appDefinition: wtypes.AppDefinition,
		payFlags: wtypes.TxParams,
		txWriter: txWriter,
		scInitParam?: unknown,
		appName?: string
	): Promise<rtypes.AppInfo> {
		return {
			creator: String(creator.addr) + "-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 1,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		};
	}

	async updateApp(
		appName: string,
		sender: Account,
		payFlags: wtypes.TxParams,
		appID: number,
		newAppCode: wtypes.SmartContract,
		flags: rtypes.AppOptionalFlags,
		txWriter: txWriter
	): Promise<rtypes.AppInfo> {
		return {
			creator: String(sender.addr) + "-get-address-dry-run",
			applicationAccount: MOCK_APPLICATION_ADDRESS,
			txID: "tx-id-dry-run",
			confirmedRound: -1,
			appID: 33,
			timestamp: 2,
			deleted: false,
			approvalFile: "approval-file.py",
			clearFile: "clear-file.py",
		};
	}

	async ensureCompiled(
		name: string,
		source: string,
		force?: boolean,
		scInitParam?: unknown,
		scParams?: SCParams
	): Promise<ASCCache> {
		return {
			filename: name,
			timestamp: 1010, // compilation time (Unix time)
			compiled: "ASDF", // the compiled code
			compiledHash: "ASDF", // hash returned by the compiler
			srcHash: 123, // source code hash
			base64ToBytes: new Uint8Array(1), // compiled base64 in bytes
			tealCode: "TEAL", // teal code
			scParams: {
				//sc params
				bob: "2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ",
				alice: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
				hash_image: "QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=",
			},
		};
	}

	async compileApplication(
		appName: string,
		source: wtypes.SmartContract,
		scTmplParams?: SCParams
	): Promise<wtypes.SourceBytes> {
		return {
			metaType: wtypes.MetaType.BYTES,
			approvalProgramBytes: new Uint8Array(32).fill(0),
			clearProgramBytes: new Uint8Array(32).fill(0),
		};
	}

	optInAccountToASA(
		asaName: string,
		assetIndex: number,
		account: rtypes.Account,
		params: wtypes.TxParams
	): Promise<void> {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	// eslint-disable-next-line sonarjs/no-identical-functions
	optInLsigToASA(
		asaName: string,
		assetIndex: number,
		lsig: LogicSigAccount,
		flags: wtypes.TxParams
	): Promise<void> {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	// eslint-disable-next-line sonarjs/no-identical-functions
	optInAccountToApp(
		sender: rtypes.Account,
		index: number,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	// eslint-disable-next-line sonarjs/no-identical-functions
	optInLsigToApp(
		appID: number,
		lsig: LogicSigAccount,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		return new Promise((resolve, reject) => {
			resolve();
		});
	}

	optInToASAMultiple(
		asaName: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags,
		accounts: rtypes.AccountMap,
		assetIndex: number
	): Promise<void> {
		return Promise.resolve();
	}
}
