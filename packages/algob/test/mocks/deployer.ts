import { types as rtypes } from "@algo-builder/runtime";
import { types as wtypes } from "@algo-builder/web";
import algosdk, { Account, LogicSigAccount, modelsv2 } from "algosdk";

import type {
	ASCCache,
	ConfirmedTxInfo,
	Deployer,
	FundASCFlags,
	LogicSig,
	LsigInfo,
	SCParams,
	TxnReceipt,
} from "../../src/types";

export class FakeDeployer implements Deployer {
	asa = new Map<string, rtypes.ASAInfo>();
	app = new Map<string, rtypes.AppInfo>();
	lsig = new Map<string, LsigInfo>();
	isDeployMode = false;
	accounts = [];
	accountsByName = new Map<string, rtypes.Account>();
	scriptName = "";
	checkpoint = {
		getAppfromCPKey(key: string): rtypes.AppInfo | undefined {
			throw new Error("Not implemented");
		},

		getAppCheckpointKeyFromIndex(index: number): string | undefined {
			throw new Error("Not implemented");
		},

		getAssetCheckpointKeyFromIndex(index: number): string | undefined {
			throw new Error("Not implemented");
		},

		getLatestTimestampValue(map: Map<number, rtypes.AppInfo>): number {
			throw new Error("Not implemented");
		},
	};

	assertNoAsset(name: string): void {
		throw new Error("Not implemented");
	}

	assertNoLsig(name: string): void {
		throw new Error("Not implemented");
	}

	assertNoApp(name: string): void {
		throw new Error("Not implemented");
	}

	getASAInfo(name: string): rtypes.ASAInfo {
		throw new Error("Not implemented");
	}

	getASADef(name: string): wtypes.ASADef {
		throw new Error("Not implemented");
	}

	persistCP(): void {
		throw new Error("Not implemented");
	}

	logTx(message: string, txConfirmation: ConfirmedTxInfo): void {
		throw new Error("Not implemented");
	}

	sendAndWait(rawTxns: Uint8Array | Uint8Array[]): Promise<TxnReceipt> {
		throw new Error("Not implemented");
	}

	registerASAInfo(name: string, asaInfo: rtypes.ASAInfo): void {
		throw new Error("Not implemented");
	}

	registerSSCInfo(name: string, sscInfo: rtypes.AppInfo): void {
		throw new Error("Not implemented");
	}

	setScriptName(name: string): void {
		this.scriptName = name;
	}

	log(msg: string, obj: any): void {
		throw new Error("Not implemented");
	}

	getAppByFile(nameApproval: string, nameClear: string): rtypes.AppInfo | undefined {
		throw new Error("Not implemented");
	}

	getApp(appName: string): rtypes.AppInfo {
		throw new Error("Not implemented");
	}

	getLsig(lsigName: string): LogicSigAccount {
		throw new Error("Not implemented");
	}

	getAppfromCPKey(key: string): rtypes.AppInfo | undefined {
		throw new Error("Not implemented");
	}

	getAppCheckpointKeyFromIndex(index: number): string | undefined {
		throw new Error("Not implemented");
	}

	getAssetCheckpointKeyFromIndex(index: number): string | undefined {
		throw new Error("Not implemented");
	}

	async loadLogicByFile(name: string, scInitParam?: unknown): Promise<LogicSigAccount> {
		throw new Error("Not implemented");
	}

	loadMultiSig(name: string): Promise<LogicSig> {
		throw new Error("Not implemented");
	}

	addCheckpointKV(key: string, value: string): void { } // eslint-disable-line @typescript-eslint/no-empty-function

	getCheckpointKV(key: string): string | undefined {
		return "metadata";
	}

	async deployASA(name: string, flags: rtypes.ASADeploymentFlags): Promise<rtypes.ASAInfo> {
		throw new Error("Not implemented");
	}

	async ensureCompiled(
		name: string,
		force?: boolean,
		scInitParam?: unknown
	): Promise<ASCCache> {
		throw new Error("Not implemented");
	}

	async compileASC(name: string, scTmplParams?: SCParams, force?: boolean): Promise<ASCCache> {
		throw new Error("Not implemented");
	}

	async compileApplication(
		appName: string,
		source: wtypes.SmartContract,
		scTmplParams?: SCParams
	): Promise<wtypes.SourceCompiled> {
		throw new Error("Not implemented");
	}

	async getDeployedASC(name: string): Promise<ASCCache | undefined> {
		throw new Error("Not implemented");
	}

	async deployASADef(
		name: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags
	): Promise<rtypes.ASAInfo> {
		throw new Error("Not implemented");
	}

	loadASADef(asaName: string): wtypes.ASADef | undefined {
		throw new Error("Not implemented");
	}

	async fundLsigByFile(
		name: string,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams,
		scInitParam?: unknown
	): Promise<void> {
		throw new Error("Not implemented");
	}

	async fundLsig(
		lsigName: string,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams
	): Promise<void> {
		throw new Error("Not implemented");
	}

	async mkDelegatedLsig(
		lsigName: string,
		fileName: string,
		signer: rtypes.Account,
		scInitParam?: unknown
	): Promise<LsigInfo> {
		throw new Error("Not implemented");
	}

	async mkContractLsig(
		lsigName: string,
		fileName: string,
		scInitParam?: unknown
	): Promise<LsigInfo> {
		throw new Error("Not implemented");
	}

	async deployApp(
		creator: Account,
		appDefinition: wtypes.AppDefinitionFromFile,
		payFlags: wtypes.TxParams,
		scInitParam?: unknown,
		appName?: string
	): Promise<rtypes.AppInfo> {
		throw new Error("Not implemented");
	}

	async updateApp(
		appName: string,
		sender: algosdk.Account,
		payFlags: wtypes.TxParams,
		appID: number,
		newAppCode: wtypes.SmartContract,
		flags: rtypes.AppOptionalFlags,
		scTmplParams?: SCParams
	): Promise<rtypes.AppInfo> {
		throw new Error("Not implemented");
	}

	assertCPNotDeleted(execParams: wtypes.ExecParams | wtypes.ExecParams[]): void {
		throw new Error("Not implemented");
	}

	isDefined(name: string): boolean {
		return false;
	}

	get algodClient(): algosdk.Algodv2 {
		throw new Error("Not implemented");
	}

	getAssetByID(assetIndex: number | bigint): Promise<modelsv2.Asset> {
		throw new Error("Not implemented");
	}

	waitForConfirmation(txId: string): Promise<TxnReceipt> {
		throw new Error("Not implemented");
	}

	optInAccountToASA(asa: string, accountName: string, flags: wtypes.TxParams): Promise<void> {
		throw new Error("Not implemented");
	}

	optInLsigToASA(asa: string, lsig: LogicSigAccount, flags: wtypes.TxParams): Promise<void> {
		throw new Error("Not implemented");
	}

	optInAccountToApp(
		sender: rtypes.Account,
		index: number,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		throw new Error("Not implemented");
	}

	optInLsigToApp(
		appID: number,
		lsig: LogicSigAccount,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		throw new Error("not implemented.");
	}

	executeTx(
		transactions: wtypes.ExecParams[] | wtypes.TransactionAndSign[]
	): Promise<TxnReceipt[]> {
		throw new Error("Not implemented");
	}

	getReceiptTxns(txns: algosdk.Transaction[]): Promise<TxnReceipt[]> {
		throw new Error("not implemented");
	}
}
