import { types as rtypes } from "@algo-builder/runtime";
import {
	BuilderError,
	ERRORS,
	mkTxParams,
	tx as webTx,
	types as wtypes,
} from "@algo-builder/web";
import { SmartContract } from "@algo-builder/web/build/types";
import algosdk, {
	Account,
	getApplicationAddress,
	LogicSigAccount,
	modelsv2,
	Transaction,
} from "algosdk";

import { txWriter } from "../internal/tx-log-writer";
import { createClient } from "../lib/driver";
import { getLsig } from "../lib/lsig";
import type {
	ASCCache,
	ConfirmedTxInfo,
	FundASCFlags,
	LsigInfo,
	Network,
	SCParams,
	TxnReceipt,
} from "../types";
import { CompileOp } from "./compile";
import * as tx from "./tx";
const confirmedRound = "confirmed-round";

// This was not exported in algosdk
export const ALGORAND_MIN_TX_FEE = 1000;
// Extracted from interaction with Algorand node (100k microAlgos)
const ALGORAND_ASA_OWNERSHIP_COST = 100000;

export function createAlgoOperator(network: Network): AlgoOperator {
	return new AlgoOperatorImpl(createClient(network));
}

export interface AlgoOperator {
	algodClient: algosdk.Algodv2;
	deployASA: (
		name: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags,
		accounts: rtypes.AccountMap,
		txWriter: txWriter
	) => Promise<rtypes.ASAInfo>;
	fundLsig: (
		lsig: string | LogicSigAccount,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams,
		txWriter: txWriter,
		scTmplParams?: SCParams
	) => Promise<LsigInfo>;
	deployApp: (
		creator: Account,
		appDefinition: wtypes.AppDefinition,
		payFlags: wtypes.TxParams,
		txWriter: txWriter,
		scTmplParams?: SCParams
	) => Promise<rtypes.AppInfo>;
	updateApp: (
		appName: string,
		sender: algosdk.Account,
		payFlags: wtypes.TxParams,
		appID: number,
		newAppCode: wtypes.SmartContract,
		flags: rtypes.AppOptionalFlags,
		txWriter: txWriter,
		scTmplParams?: SCParams
	) => Promise<rtypes.AppInfo>;
	waitForConfirmation: (txId: string) => Promise<ConfirmedTxInfo>;
	getAssetByID: (assetIndex: number | bigint) => Promise<modelsv2.Asset>;
	optInAccountToASA: (
		asaName: string,
		assetIndex: number,
		account: rtypes.Account,
		params: wtypes.TxParams
	) => Promise<void>;
	optInLsigToASA: (
		asaName: string,
		assetIndex: number,
		lsig: LogicSigAccount,
		params: wtypes.TxParams
	) => Promise<void>;
	optInToASAMultiple: (
		asaName: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags,
		accounts: rtypes.AccountMap,
		assetIndex: number
	) => Promise<void>;
	optInAccountToApp: (
		sender: rtypes.Account,
		appID: number,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	) => Promise<void>;
	optInLsigToApp: (
		appID: number,
		lsig: LogicSigAccount,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	) => Promise<void>;
	ensureCompiled: (
		name: string,
		source: string,
		force?: boolean,
		scTmplParams?: SCParams
	) => Promise<ASCCache>;
	compileApplication: (
		appName: string,
		source: wtypes.SmartContract,
		scTmplParams?: SCParams
	) => Promise<wtypes.SourceCompiled>;
	sendAndWait: (
		rawTxns: Uint8Array | Uint8Array[],
		waitRounds: number
	) => Promise<ConfirmedTxInfo>;
	getReceiptTxns: (txns: Transaction[]) => Promise<TxnReceipt[]>;
}

export class AlgoOperatorImpl implements AlgoOperator {
	algodClient: algosdk.Algodv2;
	compileOp: CompileOp;
	constructor(algocl: algosdk.Algodv2) {
		this.algodClient = algocl;
		this.compileOp = new CompileOp(this.algodClient);
	}

	/**
	 * Send signed transaction to network and wait for confirmation
	 * @param rawTxns Signed Transaction(s)
	 * @param waitRounds number of rounds to wait for transaction to be confirmed - default is 10
	 */
	async sendAndWait(
		rawTxns: Uint8Array | Uint8Array[],
		waitRounds = wtypes.WAIT_ROUNDS
	): Promise<ConfirmedTxInfo> {
		const txInfo = await this.algodClient.sendRawTransaction(rawTxns).do();
		return await this.waitForConfirmation(txInfo.txId, waitRounds);
	}

	// Source:
	// https://github.com/algorand/docs/blob/master/examples/assets/v2/javascript/AssetExample.js#L21
	// Function used to wait for a tx confirmation
	async waitForConfirmation(
		txId: string,
		waitRounds = wtypes.WAIT_ROUNDS
	): Promise<ConfirmedTxInfo> {
		const pendingInfo = await algosdk.waitForConfirmation(this.algodClient, txId, waitRounds);
		if (pendingInfo["pool-error"]) {
			throw new Error(`Transaction Pool Error: ${pendingInfo["pool-error"] as string}`);
		}
		if (pendingInfo[confirmedRound] !== null && pendingInfo[confirmedRound] > 0) {
			return pendingInfo as ConfirmedTxInfo;
		}
		throw new Error("timeout");
	}

	// Get receipts of group txn
	async getReceiptTxns(txns: Transaction[]): Promise<TxnReceipt[]> {
		const confirmedTxInfos = await Promise.all(
			txns.map((txn) => {
				return this.algodClient.pendingTransactionInformation(txn.txID()).do();
			})
		);

		return confirmedTxInfos.map((confirmedTxInfo, index) => ({
			...(confirmedTxInfo as ConfirmedTxInfo),
			txID: txns[index].txID(),
		}));
	}

	/**
	 * Queries blockchain using algodClient for asset information by index */
	async getAssetByID(assetIndex: number | bigint): Promise<modelsv2.Asset> {
		return (await this.algodClient.getAssetByID(Number(assetIndex)).do()) as modelsv2.Asset;
	}

	getTxFee(params: algosdk.SuggestedParams, txSize: number): number {
		if (params.flatFee) {
			return Math.max(ALGORAND_MIN_TX_FEE, params.fee);
		}
		return Math.max(ALGORAND_MIN_TX_FEE, txSize);
	}

	getUsableAccBalance(accountInfo: modelsv2.Account): bigint {
		// Extracted from interacting with Algorand node:
		// 7 opted-in assets require to have 800000 micro algos (frozen in account).
		// 11 assets require 1200000.
		const assets = accountInfo.assets;
		return (
			BigInt(accountInfo.amount) -
			BigInt(((assets ?? []).length + 1) * ALGORAND_ASA_OWNERSHIP_COST)
		);
	}

	getOptInTxSize(
		params: algosdk.SuggestedParams,
		accounts: rtypes.AccountMap,
		flags: wtypes.TxParams
	): number {
		const randomAccount = accounts.values().next().value;
		// assetID can't be known before ASA creation
		// it shouldn't be easy to find out the latest asset ID
		// In original source code it's uint64:
		// https://github.com/algorand/go-algorand/blob/1424855ad2b5f6755ff3feba7e419ee06f2493da/data/basics/userBalance.go#L278
		const assetID = Number.MAX_SAFE_INTEGER; // not 64 bits but 55 bits should be enough
		const sampleASAOptInTX = tx.makeASAOptInTx(randomAccount.addr, assetID, params, flags);
		const rawSignedTxn = sampleASAOptInTX.signTxn(randomAccount.sk);
		return rawSignedTxn.length;
	}

	async _optInAccountToASA(
		asaName: string,
		assetIndex: number,
		account: rtypes.Account,
		params: algosdk.SuggestedParams,
		flags: wtypes.TxParams
	): Promise<void> {
		console.log(`ASA ${String(account.name)} opt-in for ASA ${String(asaName)}`);
		const sampleASAOptInTX = tx.makeASAOptInTx(account.addr, assetIndex, params, flags);
		const rawSignedTxn = sampleASAOptInTX.signTxn(account.sk);
		await this.sendAndWait(rawSignedTxn);
	}

	async optInAccountToASA(
		asaName: string,
		assetIndex: number,
		account: rtypes.Account,
		flags: wtypes.TxParams
	): Promise<void> {
		const txParams = await mkTxParams(this.algodClient, flags);
		await this._optInAccountToASA(asaName, assetIndex, account, txParams, flags);
	}

	async optInLsigToASA(
		asaName: string,
		assetIndex: number,
		lsig: LogicSigAccount,
		flags: wtypes.TxParams
	): Promise<void> {
		console.log(`Contract ${lsig.address()} opt-in for ASA ${asaName}`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
		const txParams = await mkTxParams(this.algodClient, flags);

		const optInLsigToASATx = tx.makeASAOptInTx(lsig.address(), assetIndex, txParams, flags);
		const rawLsigSignedTx = algosdk.signLogicSigTransactionObject(optInLsigToASATx, lsig).blob;
		const txInfo = await this.algodClient.sendRawTransaction(rawLsigSignedTx).do();
		await this.waitForConfirmation(txInfo.txId);
	}

	async optInToASAMultiple(
		asaName: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags,
		accounts: rtypes.AccountMap,
		assetIndex: number
	): Promise<void> {
		const txParams = await mkTxParams(this.algodClient, flags);
		const optInAccounts = await this.checkBalanceForOptInTx(
			asaName,
			txParams,
			asaDef,
			accounts,
			flags.creator,
			flags
		);
		for (const account of optInAccounts) {
			await this._optInAccountToASA(asaName, assetIndex, account, txParams, flags);
		}
	}

	async checkBalanceForOptInTx(
		name: string,
		params: algosdk.SuggestedParams,
		asaDef: wtypes.ASADef,
		accounts: rtypes.AccountMap,
		creator: rtypes.Account,
		flags: wtypes.TxParams
	): Promise<rtypes.Account[]> {
		if (!asaDef.optInAccNames || asaDef.optInAccNames.length === 0) {
			return [];
		}
		const optInTxFee = this.getTxFee(params, this.getOptInTxSize(params, accounts, flags));
		const optInAccs = [];
		for (const accName of asaDef.optInAccNames) {
			const account = accounts.get(accName);
			if (!account) {
				throw new BuilderError(ERRORS.SCRIPT.ASA_OPT_IN_ACCOUNT_NOT_FOUND, {
					accountName: accName,
				});
			}
			optInAccs.push(account);
			if (account.addr === creator.addr) {
				throw new BuilderError(ERRORS.SCRIPT.ASA_TRIED_TO_OPT_IN_CREATOR);
			}
			const accountInfo = (await this.algodClient
				.accountInformation(account.addr)
				.do()) as modelsv2.Account;
			const requiredAmount = optInTxFee + ALGORAND_ASA_OWNERSHIP_COST;
			const usableAmount = this.getUsableAccBalance(accountInfo);
			if (usableAmount < requiredAmount) {
				throw new BuilderError(ERRORS.SCRIPT.ASA_OPT_IN_ACCOUNT_INSUFFICIENT_BALANCE, {
					accountName: accName,
					balance: usableAmount,
					requiredBalance: requiredAmount,
					asaName: name,
				});
			}
		}
		return optInAccs;
	}

	async deployASA(
		name: string,
		asaDef: wtypes.ASADef,
		flags: rtypes.ASADeploymentFlags,
		accounts: rtypes.AccountMap,
		txWriter: txWriter
	): Promise<rtypes.ASAInfo> {
		const message = "Deploying ASA: " + name;
		console.log(message);
		const txParams = await mkTxParams(this.algodClient, flags);
		const assetTX = tx.makeAssetCreateTxn(name, asaDef, flags, txParams);
		const rawSignedTxn = assetTX.signTxn(flags.creator.sk);
		const txInfo = await this.algodClient.sendRawTransaction(rawSignedTxn).do();
		const txConfirmation = await this.waitForConfirmation(txInfo.txId);
		const assetIndex = txConfirmation["asset-index"];

		txWriter.push(message, txConfirmation);
		return {
			creator: flags.creator.addr,
			txID: txInfo.txId,
			assetIndex: Number(assetIndex),
			confirmedRound: Number(txConfirmation[confirmedRound]),
			assetDef: asaDef,
			deleted: false,
		};
	}

	/**
	 * Sends Algos to ASC account (Contract Account)
	 * @param lsig     - Logic Signature (LogicSigAccount or filename with smart contract code)
	 * @param flags    - FundASC flags (as per SPEC)
	 * @param payFlags - as per SPEC
	 * @param txWriter - transaction log writer
	 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 */
	async fundLsig(
		lsig: string | LogicSigAccount,
		flags: FundASCFlags,
		payFlags: wtypes.TxParams,
		txWriter: txWriter,
		scTmplParams?: SCParams
	): Promise<LsigInfo> {
		if (typeof lsig === "string") {
			lsig = await getLsig(lsig, this.algodClient, scTmplParams);
		}

		const contractAddress = lsig.address();
		const params = await mkTxParams(this.algodClient, payFlags);
		let message = "Funding Contract: " + String(contractAddress);
		console.log(message);

		const closeToRemainder = undefined;
		const note = webTx.encodeNote(payFlags.note, payFlags.noteb64);
		const t = algosdk.makePaymentTxnWithSuggestedParams(
			flags.funder.addr,
			contractAddress,
			flags.fundingMicroAlgo,
			closeToRemainder,
			note,
			params
		);
		const signedTxn = t.signTxn(flags.funder.sk);
		const txInfo = await this.algodClient.sendRawTransaction(signedTxn).do();
		const confirmedTxn = await this.waitForConfirmation(txInfo.txId);
		message = message.concat("\nLsig: " + lsig.address());
		txWriter.push(message, confirmedTxn);
		return {
			creator: flags.funder.addr,
			contractAddress: contractAddress,
			lsig: lsig,
		};
	}

	/**
	 * Function to deploy Stateful Smart Contract
	 * @param creator Creator of application aka deployer
	 * @param appDefinition   Application Definition
	 * @param payFlags      TxParams
	 * @param txWriter
	 * @param scTmplParams: Smart contract template parameters (used only when compiling PyTEAL to TEAL)
	 */
	async deployApp(
		creator: Account,
		appDefinition: wtypes.AppDefinition,
		payFlags: wtypes.TxParams,
		txWriter: txWriter,
		scTmplParams?: SCParams
	): Promise<rtypes.AppInfo> {
		const params = await mkTxParams(this.algodClient, payFlags);

		const appProgramBytes = await this.compileApplication(
			appDefinition.appName,
			appDefinition,
			scTmplParams
		);

		const execParam: wtypes.DeployAppParam = {
			type: wtypes.TransactionType.DeployApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: creator,
			appDefinition: {
				...appDefinition,
				...appProgramBytes,
			},
			payFlags: payFlags,
		};

		const txn = webTx.mkTransaction(execParam, params);
		const txId = txn.txID().toString();
		const signedTxn = txn.signTxn(creator.sk);

		const txInfo = await this.algodClient.sendRawTransaction(signedTxn).do();
		const confirmedTxInfo = await this.waitForConfirmation(txId);

		const appId = confirmedTxInfo["application-index"];
		const message = `Signed transaction with txID: ${txId}\nCreated new app-id: ${appId}`; // eslint-disable-line @typescript-eslint/restrict-template-expressions

		console.log(message);
		txWriter.push(message, confirmedTxInfo);

		return {
			creator: creator.addr,
			txID: txInfo.txId,
			confirmedRound: Number(confirmedTxInfo[confirmedRound]),
			appID: Number(appId),
			applicationAccount: getApplicationAddress(Number(appId)),
			timestamp: Math.round(+new Date() / 1000),
			deleted: false,
			approvalFile:
				appDefinition.metaType === wtypes.MetaType.FILE
					? appDefinition.approvalProgramFilename
					: `${appDefinition.appName} - approval.teal`,
			clearFile:
				appDefinition.metaType === wtypes.MetaType.FILE
					? appDefinition.clearProgramFilename
					: `${appDefinition.appName} - clear.teal`,
		};
	}

	/**
	 * Update programs (approval, clear) for a stateful smart contract.
	 * @param sender Account from which call needs to be made
	 * @param payFlags Transaction Flags
	 * @param appID index of the application being configured
	 * @param newAppCode new source of application
	 * @param flags Optional parameters to SSC (accounts, args..)
	 * @param txWriter - transaction log writer
	 * @param scTmplParams: scTmplParams: Smart contract template parameters
	 *     (used only when compiling PyTEAL to TEAL)
	 */
	async updateApp(
		appName: string,
		sender: algosdk.Account,
		payFlags: wtypes.TxParams,
		appID: number,
		newAppCode: wtypes.SmartContract,
		flags: rtypes.AppOptionalFlags,
		txWriter: txWriter,
		scTmplParams?: SCParams
	): Promise<rtypes.AppInfo> {
		const params = await mkTxParams(this.algodClient, payFlags);

		const appProgramBytes = await this.compileApplication(appName, newAppCode, scTmplParams);

		const execParam: wtypes.ExecParams = {
			appName,
			type: wtypes.TransactionType.UpdateApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: sender,
			appID: appID,
			newAppCode: appProgramBytes,
			payFlags: payFlags,
			accounts: flags.accounts,
			foreignApps: flags.foreignApps,
			foreignAssets: flags.foreignAssets,
			appArgs: flags.appArgs,
			note: flags.note,
			lease: flags.lease,
		};

		const txn = webTx.mkTransaction(execParam, params);
		const txId = txn.txID().toString();
		const signedTxn = txn.signTxn(sender.sk);

		const txInfo = await this.algodClient.sendRawTransaction(signedTxn).do();
		const confirmedTxInfo = await this.waitForConfirmation(txId);

		const message = `Signed transaction with txID: ${txId}\nUpdated app-id: ${appID}`; // eslint-disable-line @typescript-eslint/restrict-template-expressions

		console.log(message);
		txWriter.push(message, confirmedTxInfo);

		return {
			creator: sender.addr,
			txID: txInfo.txId,
			confirmedRound: Number(confirmedTxInfo[confirmedRound]),
			appID: appID,
			applicationAccount: getApplicationAddress(appID),
			timestamp: Math.round(+new Date() / 1000),
			deleted: false,
			approvalFile:
				newAppCode.metaType === wtypes.MetaType.FILE
					? newAppCode.approvalProgramFilename
					: `${appName} - approval.teal`,
			clearFile:
				newAppCode.metaType === wtypes.MetaType.FILE
					? newAppCode.clearProgramFilename
					: `${appName} - clear.teal`,
		};
	}

	/**
	 * Opt-In to stateful smart contract
	 *  - signed by account's secret key
	 * @param sender: Account for which opt-in is required
	 * @param appID: Application Index: (ID of the application)
	 * @param payFlags: Transaction Params
	 * @param flags Optional parameters to SSC (accounts, args..)
	 */
	async optInAccountToApp(
		sender: rtypes.Account,
		appID: number,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		const params = await mkTxParams(this.algodClient, payFlags);
		const execParam: wtypes.ExecParams = {
			type: wtypes.TransactionType.OptInToApp,
			sign: wtypes.SignType.SecretKey,
			fromAccount: sender,
			appID: appID,
			payFlags: payFlags,
			appArgs: flags.appArgs,
			accounts: flags.accounts,
			foreignApps: flags.foreignApps,
			foreignAssets: flags.foreignAssets,
		};

		const txn = webTx.mkTransaction(execParam, params);
		const signedTxn = txn.signTxn(sender.sk);
		await this.sendAndWait(signedTxn);
	}

	/**
	 * Opt-In to stateful smart contract (SSC) for a contract account
	 * The opt-in transaction is signed by the logic signature
	 * @param appID application index
	 * @param lsig logic signature
	 * @param payFlags Transaction flags
	 * @param flags Optional parameters to SSC (accounts, args..)
	 */
	async optInLsigToApp(
		appID: number,
		lsig: LogicSigAccount,
		payFlags: wtypes.TxParams,
		flags: rtypes.AppOptionalFlags
	): Promise<void> {
		console.log(`Contract ${lsig.address()} opt-in for SSC ID ${appID}`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
		const params = await mkTxParams(this.algodClient, payFlags);
		const execParam: wtypes.ExecParams = {
			type: wtypes.TransactionType.OptInToApp,
			sign: wtypes.SignType.LogicSignature,
			fromAccountAddr: lsig.address(),
			lsig: lsig,
			appID: appID,
			payFlags: payFlags,
			appArgs: flags.appArgs,
			accounts: flags.accounts,
			foreignApps: flags.foreignApps,
			foreignAssets: flags.foreignAssets,
		};
		const optInLsigToAppTx = webTx.mkTransaction(execParam, params);

		const rawLsigSignedTx = algosdk.signLogicSigTransactionObject(optInLsigToAppTx, lsig).blob;
		await this.sendAndWait(rawLsigSignedTx);
	}

	async ensureCompiled(
		name: string,
		source: string,
		force?: boolean,
		scTmplParams?: SCParams
	): Promise<ASCCache> {
		return await this.compileOp.ensureCompiled(name, source, force, scTmplParams);
	}

	/**
	 * Return application in bytes source format
	 * @param appName app name
	 * @param source
	 * @param scTmplParams
	 * @returns application in bytes format
	 */
	async compileApplication(
		appName: string,
		source: wtypes.SmartContract,
		scTmplParams?: SCParams
	): Promise<wtypes.SourceCompiled> {
		// in case of bytes source we do not need to compile it
		if (source.metaType === wtypes.MetaType.BYTES) return source;

		let approvalFile = `${appName} - approval.teal`;
		let clearFile = `${appName} - clear.teal`;
		let approvalSource = "";
		let clearSource = "";

		if (source.metaType === wtypes.MetaType.FILE) {
			approvalFile = source.approvalProgramFilename;
			clearFile = source.clearProgramFilename;
		}

		if (source.metaType === wtypes.MetaType.SOURCE_CODE) {
			approvalSource = source.approvalProgramCode;
			clearSource = source.clearProgramCode;
		}

		const app = await this.ensureCompiled(approvalFile, approvalSource, false, scTmplParams);
		const clear = await this.ensureCompiled(clearFile, clearSource, false, scTmplParams);

		// convert to base64 format
		const approvalProgramBytes = new Uint8Array(Buffer.from(app.compiled, "base64"));
		const clearProgramBytes = new Uint8Array(Buffer.from(clear.compiled, "base64"));

		return {
			metaType: wtypes.MetaType.BYTES,
			approvalProgramBytes,
			clearProgramBytes,
		};
	}
}
