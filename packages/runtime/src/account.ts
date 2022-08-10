import { types } from "@algo-builder/web";
import { Account as AccountSDK, Address, generateAccount, modelsv2 } from "algosdk";

import { RUNTIME_ERRORS } from "./errors/errors-list";
import { RuntimeError } from "./errors/runtime-errors";
import { checkAndSetASAFields } from "./lib/asa";
import {
	ALGORAND_ACCOUNT_MIN_BALANCE,
	APPLICATION_BASE_FEE,
	ASSET_CREATION_FEE,
	MAX_ALGORAND_ACCOUNT_ASSETS,
	MAX_ALGORAND_ACCOUNT_CREATED_APPS,
	MAX_ALGORAND_ACCOUNT_OPTEDIN_APPS,
	SSC_VALUE_BYTES,
	SSC_VALUE_UINT,
} from "./lib/constants";
import { keyToBytes } from "./lib/parsing";
import { assertValidSchema } from "./lib/stateful";
import {
	AccountAddress,
	AccountStoreI,
	AppLocalStateM,
	AssetHoldingM,
	CreatedAppM,
	RuntimeAccountI,
	SSCAttributesM,
	StackElem,
} from "./types";

const StateMap = "key-value";
const globalState = "global-state";
const localStateSchema = "local-state-schema";
const globalStateSchema = "global-state-schema";

export class RuntimeAccount implements RuntimeAccountI {
	readonly sk: Uint8Array; // signing key (private key or lsig)
	readonly addr: string;
	name?: string;

	// spend is the authorized address of account
	// any transaction from account object should be signed by `spend` address
	spend: types.AccountAddress;

	constructor(account: AccountSDK, name?: string) {
		this.sk = account.sk;
		this.addr = account.addr;
		this.name = name;
		this.spend = account.addr;
	}

	// rekey to authAccountAddress
	rekeyTo(authAccountAddress: types.AccountAddress): void {
		this.spend = authAccountAddress;
	}

	// get spend address, return this.address if spend not exist.
	getSpendAddress(): types.AccountAddress {
		return this.spend ? this.spend : this.addr;
	}
}

export class AccountStore implements AccountStoreI {
	readonly account: RuntimeAccountI;
	readonly address: string;
	minBalance: number; // required minimum balance for account
	assets: Map<number, AssetHoldingM>;
	amount: bigint;
	appsLocalState: Map<number, AppLocalStateM>;
	appsTotalSchema: modelsv2.ApplicationStateSchema;
	createdApps: Map<number, SSCAttributesM>;
	createdAssets: Map<number, modelsv2.AssetParams>;

	/** Creates a new Algorand state account.
	 * @balance: initial Algo balance (in micro Algo)
	 * @account: algo-sdk Account type or string. If strirng is provided then it is used
	 *   as an account name.  If algo-sdk Account is not used than a random account is generated
	 *   (with an associated private key)
	 * */
	constructor(balance: number | bigint, account?: AccountSDK | string) {
		if (typeof account === "string") {
			// create new account with name
			this.account = new RuntimeAccount(generateAccount(), account);
		} else if (account) {
			// create new account with AccountSDK data
			this.account = new RuntimeAccount(account);
		} else {
			// create new account because user passed nothing.
			this.account = new RuntimeAccount(generateAccount());
		}

		this.address = this.account.addr;
		this.assets = new Map<number, AssetHoldingM>();
		this.amount = BigInt(balance);
		this.minBalance = ALGORAND_ACCOUNT_MIN_BALANCE;
		this.appsLocalState = new Map<number, AppLocalStateM>();
		this.appsTotalSchema = <modelsv2.ApplicationStateSchema>{};
		this.createdApps = new Map<number, SSCAttributesM>();
		this.createdAssets = new Map<number, modelsv2.AssetParams>();
	}

	// returns account balance in microAlgos
	balance(): bigint {
		return this.amount;
	}

	// change spend account
	rekeyTo(authAccountAddress: types.AccountAddress): void {
		this.account.rekeyTo(authAccountAddress);
	}

	// get spend address of this account
	getSpendAddress(): AccountAddress {
		return this.account.getSpendAddress();
	}

	/**
	 * Fetches local state value for key present in account
	 * returns undefined otherwise
	 * @param appID: current application id
	 * @param key: key to fetch value of from local state
	 */
	getLocalState(appID: number, key: Uint8Array | string): StackElem | undefined {
		const localState = this.appsLocalState;
		const data = localState.get(appID)?.[StateMap]; // can be undefined (eg. app opted in)
		const localKey = keyToBytes(key);
		return data?.get(localKey.toString());
	}

	/**
	 * Set new key-value pair or update pair with existing key in account
	 * for application id: appID, throw error otherwise
	 * @param appID: current application id
	 * @param key: key to fetch value of from local state
	 * @param value: value of key to put in local state
	 * @param line line number in TEAL file
	 * Note: if user is accessing this function directly through runtime,
	 * then line number is unknown
	 */
	setLocalState(
		appID: number,
		key: Uint8Array | string,
		value: StackElem,
		line?: number
	): AppLocalStateM {
		const lineNumber = line ?? "unknown";
		const localState = this.appsLocalState.get(appID);
		const localApp = localState?.[StateMap];
		if (localState && localApp) {
			const localKey = keyToBytes(key);
			localApp.set(localKey.toString(), value);
			localState[StateMap] = localApp; // save updated state

			assertValidSchema(localState[StateMap], localState.schema); // verify if updated schema is valid by config
			return localState;
		}

		throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
			appID: appID,
			line: lineNumber,
		});
	}

	/**
	 * Queries app global state value. Returns `undefined` if the key is not present.
	 * @param appID: current application id
	 * @param key: key to fetch value of from local state
	 */
	getGlobalState(appID: number, key: Uint8Array | string): StackElem | undefined {
		const app = this.getApp(appID);
		if (!app) return undefined;
		const appGlobalState = app[globalState];
		const globalKey = keyToBytes(key);
		return appGlobalState.get(globalKey.toString());
	}

	/**
	 * Updates app global state.
	 * Throws error if app is not found.
	 * @param appID: application id
	 * @param key: app global state key
	 * @param value: value associated with a key
	 */
	setGlobalState(
		appID: number,
		key: Uint8Array | string,
		value: StackElem,
		line?: number
	): void {
		const app = this.getApp(appID);
		if (app === undefined)
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: line ?? "unknown",
			});
		const appGlobalState = app[globalState];
		const globalKey = keyToBytes(key);
		appGlobalState.set(globalKey.toString(), value); // set new value in global state
		app[globalState] = appGlobalState; // save updated state

		assertValidSchema(app[globalState], app[globalStateSchema]); // verify if updated schema is valid by config
	}

	/**
	 * Queries application by application index from account's global state.
	 * Returns undefined if app is not found.
	 * @param appID application index
	 */
	getApp(appID: number): SSCAttributesM | undefined {
		return this.createdApps.get(appID);
	}

	/**
	 * Queries application by application index from account's local state.
	 * Returns undefined if app is not found.
	 * @param appID application index
	 */
	getAppFromLocal(appID: number): AppLocalStateM | undefined {
		return this.appsLocalState.get(appID);
	}

	/**
	 * Queries asset definition by assetId
	 * @param assetId asset index
	 */
	getAssetDef(assetId: number): modelsv2.AssetParams | undefined {
		return this.createdAssets.get(assetId);
	}

	/**
	 * Queries asset holding by assetId
	 * @param assetId asset index
	 */
	getAssetHolding(assetId: number): AssetHoldingM | undefined {
		return this.assets.get(assetId);
	}

	/**
	 * Deploy Asset in account's state
	 * @param assetId Asset Index
	 * @param name Asset Name
	 * @param asaDef Asset Definitions
	 */
	addAsset(assetId: number, name: string, asaDef: types.ASADef): modelsv2.AssetParams {
		if (this.createdAssets.size === MAX_ALGORAND_ACCOUNT_ASSETS) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.MAX_LIMIT_ASSETS, {
				name: name,
				address: this.address,
				max: MAX_ALGORAND_ACCOUNT_ASSETS,
			});
		}

		this.minBalance += ASSET_CREATION_FEE;
		const asset = new Asset(assetId, asaDef, this.address, name);
		this.createdAssets.set(asset.id, asset.definitions);
		// set holding in creator account. note: for creator default-frozen is always false
		// https://developer.algorand.org/docs/reference/rest-apis/algod/v2/#assetparams
		const assetHolding: AssetHoldingM = {
			amount: BigInt(asaDef.total), // for creator opt-in amount is total assets
			"asset-id": assetId,
			creator: this.address,
			"is-frozen": false,
		};
		this.assets.set(assetId, assetHolding);
		return asset.definitions;
	}

	/**
	 * Modifies Asset fields
	 * @param assetId Asset Index
	 * @param fields Fields for modification
	 */
	modifyAsset(assetId: number, fields: types.AssetModFields): void {
		const asset = this.getAssetDef(assetId);
		if (asset === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND, { assetId: assetId });
		}
		// check for blank fields
		checkAndSetASAFields(fields, asset);
	}

	/**
	 * removes asset holding from account
	 * @param assetId asset index
	 */
	closeAsset(assetId: number): void {
		/**
		 * NOTE: We don't throw error/warning here if asset holding is not found, because this code
		 * will not be executed if asset holding doesn't exist (as need to empty this.account to closeRemTo
		 * in runtime via ctx.transferAsset before removing asset holding)
		 */
		if (this.assets.has(assetId)) {
			this.minBalance -= ASSET_CREATION_FEE;
			// https://developer.algorand.org/docs/reference/transactions/#asset-transfer-transaction
			this.assets.delete(assetId); // remove asset holding from account
		}
	}

	/**
	 * Freeze asset
	 * @param assetId Asset Index
	 * @state new freeze state
	 */
	setFreezeState(assetId: number, state: boolean): void {
		const holding = this.assets.get(assetId);
		if (holding === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.TRANSACTION.ASA_NOT_OPTIN, {
				address: this.address,
				assetId: assetId,
			});
		}
		holding["is-frozen"] = state;
	}

	/**
	 * Destroys asset
	 * @param assetId Asset Index
	 */
	destroyAsset(assetId: number): void {
		const holding = this.assets.get(assetId);
		const asset = this.getAssetDef(assetId);
		if (holding === undefined || asset === undefined) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_NOT_FOUND, { assetId: assetId });
		}
		if (holding.amount !== asset.total) {
			throw new RuntimeError(RUNTIME_ERRORS.ASA.ASSET_TOTAL_ERROR);
		}
		this.minBalance -= ASSET_CREATION_FEE;
		this.createdAssets.delete(assetId);
		this.assets.delete(assetId);
	}

	/**
	 * Deploy application in account's state
	 * check maximum account creation limit
	 * @param appID application index
	 * @param appDefinition application definition metadata
	 * NOTE - approval and clear program must be the TEAL code as string
	 */
	addApp(appID: number, appDefinition: types.AppDefinitionFromSource): CreatedAppM {
		if (this.createdApps.size === MAX_ALGORAND_ACCOUNT_CREATED_APPS) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.MAX_LIMIT_APPS, {
				address: this.address,
				max: MAX_ALGORAND_ACCOUNT_CREATED_APPS,
			});
		}

		// raise minimum balance
		// https://developer.algorand.org/docs/features/asc1/stateful/#minimum-balance-requirement-for-a-smart-contract
		this.minBalance +=
			APPLICATION_BASE_FEE +
			SSC_VALUE_UINT * appDefinition.globalInts +
			SSC_VALUE_BYTES * appDefinition.globalBytes;
		const app = new App(this.address, appID, appDefinition);
		this.createdApps.set(app.id, app.attributes);
		return app;
	}

	// opt in to application
	optInToApp(appID: number, appParams: SSCAttributesM): void {
		const localState = this.appsLocalState.get(appID); // fetch local state from account
		if (localState) {
			throw new Error(`${this.address} is already opted in to app ${appID}`);
		} else {
			if (this.appsLocalState.size === MAX_ALGORAND_ACCOUNT_OPTEDIN_APPS) {
				throw new Error(
					`Maximum Opt In applications per account is ${MAX_ALGORAND_ACCOUNT_OPTEDIN_APPS}`
				);
			}

			// https://developer.algorand.org/docs/features/asc1/stateful/#minimum-balance-requirement-for-a-smart-contract
			this.minBalance +=
				APPLICATION_BASE_FEE +
				SSC_VALUE_UINT * Number(appParams[localStateSchema].numUint) +
				SSC_VALUE_BYTES * Number(appParams[localStateSchema].numByteSlice);

			// create new local app attribute
			const localParams: AppLocalStateM = {
				id: appID,
				"key-value": new Map<string, StackElem>(),
				schema: appParams[localStateSchema],
			};
			this.appsLocalState.set(appID, localParams);
		}
	}

	// opt-in to asset
	optInToASA(assetIndex: number, assetHolding: AssetHoldingM): void {
		const accAssetHolding = this.assets.get(assetIndex); // fetch asset holding of account
		if (accAssetHolding) {
			console.warn(`${this.address} is already opted in to asset ${assetIndex}`);
		} else {
			if (this.createdAssets.size + this.assets.size === MAX_ALGORAND_ACCOUNT_ASSETS) {
				throw new RuntimeError(RUNTIME_ERRORS.ASA.MAX_LIMIT_ASSETS, {
					address: assetHolding.creator,
					max: MAX_ALGORAND_ACCOUNT_ASSETS,
				});
			}

			this.minBalance += ASSET_CREATION_FEE;
			this.assets.set(assetIndex, assetHolding);
		}
	}

	// delete application from account's global state (createdApps)
	deleteApp(appID: number): void {
		const app = this.createdApps.get(appID);
		if (!app) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: "unknown",
			});
		}

		// reduce minimum balance
		this.minBalance -=
			APPLICATION_BASE_FEE +
			SSC_VALUE_UINT * Number(app[globalStateSchema].numUint) +
			SSC_VALUE_BYTES * Number(app[globalStateSchema].numByteSlice);
		this.createdApps.delete(appID);
	}

	// close(delete) application from account's local state (appsLocalState)
	closeApp(appID: number): void {
		const localApp = this.appsLocalState.get(appID);
		if (!localApp) {
			throw new RuntimeError(RUNTIME_ERRORS.GENERAL.APP_NOT_FOUND, {
				appID: appID,
				line: "unknown",
			});
		}

		// decrease min balance
		this.minBalance -=
			APPLICATION_BASE_FEE +
			SSC_VALUE_UINT * Number(localApp.schema.numUint) +
			SSC_VALUE_BYTES * Number(localApp.schema.numByteSlice);
		this.appsLocalState.delete(appID);
	}
}

// represents stateful application
class App {
	readonly id: number;
	readonly attributes: SSCAttributesM;

	// NOTE - approval and clear program must be the TEAL code as string
	constructor(
		creatorAddr: AccountAddress,
		appID: number,
		appDefinition: types.AppDefinitionFromSource
	) {
		this.id = appID;
		const base: BaseModel = new BaseModelI();
		this.attributes = {
			"approval-program": appDefinition.approvalProgramCode,
			"clear-state-program": appDefinition.clearProgramCode,
			creator: creatorAddr,
			"global-state": new Map<string, StackElem>(),
			"global-state-schema": {
				...base,
				numByteSlice: appDefinition.globalBytes,
				numUint: appDefinition.globalInts,
			},
			"local-state-schema": {
				...base,
				numByteSlice: appDefinition.localBytes,
				numUint: appDefinition.localInts,
			},
		};
	}
}

// represents asset
class Asset {
	readonly id: number;
	readonly definitions: modelsv2.AssetParams;

	constructor(assetId: number, def: types.ASADef, creator: string, assetName: string) {
		this.id = assetId;
		const base: BaseModel = new BaseModelI();
		this.definitions = {
			...base,
			name: assetName,
			creator: creator,
			total: BigInt(def.total),
			decimals: def.decimals,
			defaultFrozen: def.defaultFrozen ?? false,
			unitName: def.unitName,
			url: def.url,
			metadataHash:
				typeof def.metadataHash === "string"
					? new Uint8Array(Buffer.from(def.metadataHash, "base64"))
					: def.metadataHash,
			manager: def.manager,
			reserve: def.reserve,
			freeze: def.freeze,
			clawback: def.clawback,
		};
	}
}

export interface BaseModel {
	attribute_map: Record<string, string>;
	_is_primitive: (val: any) => val is string | boolean | number | bigint;
	_is_address: (val: any) => val is Address;
	/* eslint-disable*/
	_get_obj_for_encoding(val: Function): Record<string, any>;
	_get_obj_for_encoding(val: any[]): any[];
	_get_obj_for_encoding(val: Record<string, any>): Record<string, any>;
	get_obj_for_encoding(): Record<string, any>;
}

export class BaseModelI implements BaseModel {
	attribute_map: Record<string, string>;

	public constructor() {
		this.attribute_map = {};
	}
	_is_primitive(val: any): val is string | boolean | number | bigint {
		return true;
	}

	_is_address(val: any): val is Address {
		throw new Error("_is_address Not Implemented");
	}

	_get_obj_for_encoding(val: Function): Record<string, any>;
	_get_obj_for_encoding(val: any[]): any[];
	_get_obj_for_encoding(val: Record<string, any>): Record<string, any> {
		throw new Error("_get_obj_for_encoding Not Implemented");
	}

	get_obj_for_encoding(): Record<string, any> {
		throw new Error("get_obj_for_encoding Not Implemented");
	}
}

//list of 16 predefined accounts
export const defaultSDKAccounts = {
	alice: {
		addr: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
		sk: new Uint8Array([
			216, 208, 24, 102, 119, 86, 131, 225, 119, 183, 127, 17, 94, 11, 60, 39, 234, 161, 247,
			147, 158, 200, 187, 99, 233, 40, 118, 215, 63, 134, 206, 221, 32, 238, 110, 24, 193, 33,
			202, 182, 223, 192, 249, 77, 61, 151, 217, 220, 224, 100, 83, 214, 173, 82, 215, 92, 216,
			93, 91, 53, 216, 110, 17, 18,
		]),
	},
	bob: {
		addr: "L4GMOPCKAB2FMJ7RWAREWZURDCJU3YWEPNTLHPD2WHQICFGHAG2KPCD57Y",
		sk: new Uint8Array([
			148, 79, 187, 213, 57, 176, 56, 132, 106, 179, 248, 237, 104, 127, 209, 144, 49, 22, 65,
			134, 0, 167, 237, 128, 17, 17, 163, 77, 119, 110, 133, 183, 95, 12, 199, 60, 74, 0, 116,
			86, 39, 241, 176, 34, 75, 102, 145, 24, 147, 77, 226, 196, 123, 102, 179, 188, 122, 177,
			224, 129, 20, 199, 1, 180,
		]),
	},
	carlos: {
		addr: "YUFEPZ4BPFTD6RERL25T5JFIC44NWOAGUBOFE3G73RDKG64ONLHQ6DGDY4",
		sk: new Uint8Array([
			120, 26, 48, 177, 69, 236, 14, 67, 86, 40, 59, 126, 57, 42, 43, 98, 250, 238, 188, 161,
			54, 85, 23, 99, 143, 10, 154, 201, 42, 108, 137, 236, 197, 10, 71, 231, 129, 121, 102, 63,
			68, 145, 94, 187, 62, 164, 168, 23, 56, 219, 56, 6, 160, 92, 82, 108, 223, 220, 70, 163,
			123, 142, 106, 207,
		]),
	},
	david: {
		addr: "URJ6KFE6X3VRKEONCCF22PKEPJIV3ICIZDWY7HVQ6P5AR4XN6IK6UZLNQI",
		sk: new Uint8Array([
			199, 222, 194, 229, 151, 226, 34, 10, 55, 247, 96, 194, 188, 248, 160, 77, 187, 213, 151,
			2, 208, 253, 118, 55, 180, 219, 162, 31, 41, 62, 69, 63, 164, 83, 229, 20, 158, 190, 235,
			21, 17, 205, 16, 139, 173, 61, 68, 122, 81, 93, 160, 72, 200, 237, 143, 158, 176, 243,
			250, 8, 242, 237, 242, 21,
		]),
	},
	eve: {
		addr: "ZINQHBWHYKQQQKSAPQ6UD2XICPPZZNOYBL5CX6ZY563WCCVFAM4UYI2TYU",
		sk: new Uint8Array([
			108, 42, 43, 112, 178, 186, 247, 130, 60, 47, 170, 34, 111, 171, 165, 115, 217, 28, 169,
			95, 20, 80, 30, 2, 251, 195, 37, 202, 161, 245, 57, 52, 202, 27, 3, 134, 199, 194, 161, 8,
			42, 64, 124, 61, 65, 234, 232, 19, 223, 156, 181, 216, 10, 250, 43, 251, 56, 239, 183, 97,
			10, 165, 3, 57,
		]),
	},
	frank: {
		addr: "54ZDLRR7EDYSGVAIIWB65JBGVK3T2XTFYJBNZJ7C26DIG5E3C45NFNEOKI",
		sk: new Uint8Array([
			206, 240, 249, 166, 85, 75, 93, 81, 34, 97, 209, 30, 175, 98, 11, 151, 46, 240, 137, 27,
			49, 192, 221, 161, 52, 176, 249, 216, 88, 233, 170, 75, 239, 50, 53, 198, 63, 32, 241, 35,
			84, 8, 69, 131, 238, 164, 38, 170, 183, 61, 94, 101, 194, 66, 220, 167, 226, 215, 134,
			131, 116, 155, 23, 58,
		]),
	},
	grace: {
		addr: "IIX4QQBRTTWLGPC5AZV2KZ6KSDHDQ7U33V3C2RVIDUOD73OEAAIWL34BZ4",
		sk: new Uint8Array([
			26, 227, 242, 79, 149, 203, 96, 216, 174, 137, 136, 141, 20, 166, 163, 134, 94, 110, 120,
			82, 19, 130, 205, 31, 110, 23, 169, 103, 166, 188, 241, 210, 66, 47, 200, 64, 49, 156,
			236, 179, 60, 93, 6, 107, 165, 103, 202, 144, 206, 56, 126, 155, 221, 118, 45, 70, 168,
			29, 28, 63, 237, 196, 0, 17,
		]),
	},
	heidi: {
		addr: "23ZZOJFSTHTNFW7LDOFXQG7YPT2EOXQ4ZMFZKL4JCVH35F7QZX6QOJZIPE",
		sk: new Uint8Array([
			214, 97, 59, 157, 59, 4, 74, 38, 52, 143, 58, 117, 203, 80, 229, 167, 98, 79, 138, 147,
			138, 79, 34, 184, 36, 109, 121, 60, 205, 7, 36, 181, 214, 243, 151, 36, 178, 153, 230,
			210, 219, 235, 27, 139, 120, 27, 248, 124, 244, 71, 94, 28, 203, 11, 149, 47, 137, 21, 79,
			190, 151, 240, 205, 253,
		]),
	},
	ivan: {
		addr: "T35DJDE56G55FOWP7C6UYFL6ZBFP3UWCR2GOS5V67I7MYM575KZ7AGITAE",
		sk: new Uint8Array([
			90, 193, 60, 254, 182, 162, 198, 244, 251, 48, 102, 219, 70, 65, 172, 69, 232, 153, 242,
			72, 249, 83, 4, 219, 182, 190, 73, 23, 221, 197, 46, 183, 158, 250, 52, 140, 157, 241,
			187, 210, 186, 207, 248, 189, 76, 21, 126, 200, 74, 253, 210, 194, 142, 140, 233, 118,
			190, 250, 62, 204, 51, 191, 234, 179,
		]),
	},
	judy: {
		addr: "2NXSWBODWXMHGGTXBVCHNO5P2GD4C5YQZYQGS2WKC27A33WDUXU5UJRFTI",
		sk: new Uint8Array([
			255, 173, 16, 150, 30, 185, 63, 119, 126, 103, 254, 11, 77, 163, 99, 229, 145, 42, 232,
			207, 183, 230, 198, 105, 118, 94, 189, 106, 49, 128, 3, 6, 211, 111, 43, 5, 195, 181, 216,
			115, 26, 119, 13, 68, 118, 187, 175, 209, 135, 193, 119, 16, 206, 32, 105, 106, 202, 22,
			190, 13, 238, 195, 165, 233,
		]),
	},
	ken: {
		addr: "NWAMR6YPAGXXMFYEGIJAK3L2PQORKHF2RZDCGYIVGXRNUP35EO64TT7CZI",
		sk: new Uint8Array([
			195, 166, 5, 3, 236, 248, 36, 237, 176, 13, 32, 194, 248, 131, 14, 33, 91, 78, 191, 142,
			173, 169, 240, 35, 118, 63, 58, 88, 19, 39, 22, 204, 109, 128, 200, 251, 15, 1, 175, 118,
			23, 4, 50, 18, 5, 109, 122, 124, 29, 21, 28, 186, 142, 70, 35, 97, 21, 53, 226, 218, 63,
			125, 35, 189,
		]),
	},
	laura: {
		addr: "ARMWP6P2ZYVJVLOTERYCJGZR455DUQJ3YWPV4C5F3OOGQEWGHYWVYJ2OXU",
		sk: new Uint8Array([
			69, 87, 103, 186, 219, 38, 91, 89, 25, 152, 220, 4, 175, 162, 38, 186, 40, 114, 247, 219,
			156, 234, 3, 199, 60, 19, 250, 1, 51, 54, 171, 103, 4, 89, 103, 249, 250, 206, 42, 154,
			173, 211, 36, 112, 36, 155, 49, 231, 122, 58, 65, 59, 197, 159, 94, 11, 165, 219, 156,
			104, 18, 198, 62, 45,
		]),
	},
	mike: {
		addr: "CHZUTSF4KRNHHZGJW3CSWH5PUTI3OYQKAQLO3TV33NJ6CJ3XIVA6OFW2MI",
		sk: new Uint8Array([
			73, 249, 133, 91, 33, 125, 51, 176, 254, 186, 18, 156, 136, 212, 7, 22, 112, 219, 157, 59,
			202, 173, 230, 174, 200, 144, 143, 253, 217, 118, 198, 185, 17, 243, 73, 200, 188, 84, 90,
			115, 228, 201, 182, 197, 43, 31, 175, 164, 209, 183, 98, 10, 4, 22, 237, 206, 187, 219,
			83, 225, 39, 119, 69, 65,
		]),
	},
	norman: {
		addr: "56K4SLIB46XMM7MXPBECKRDARIBSUJEBCSXKV4KZJZB4VLHSVFIDOWDOIQ",
		sk: new Uint8Array([
			220, 93, 50, 78, 203, 174, 211, 156, 72, 136, 40, 29, 141, 129, 75, 168, 91, 248, 35, 77,
			62, 30, 217, 131, 125, 91, 148, 185, 70, 88, 213, 245, 239, 149, 201, 45, 1, 231, 174,
			198, 125, 151, 120, 72, 37, 68, 96, 138, 3, 42, 36, 129, 20, 174, 170, 241, 89, 78, 67,
			202, 172, 242, 169, 80,
		]),
	},
	olivia: {
		addr: "JQFKSTHN3ACRDRMDLKBBF3IQUSYPFKQAM7ZNGFFC4EDS5SMMXDG2ZYLPDE",
		sk: new Uint8Array([
			207, 110, 138, 138, 238, 131, 206, 41, 160, 19, 4, 206, 204, 146, 165, 171, 46, 224, 247,
			131, 32, 81, 21, 214, 126, 182, 234, 55, 43, 155, 202, 119, 76, 10, 169, 76, 237, 216, 5,
			17, 197, 131, 90, 130, 18, 237, 16, 164, 176, 242, 170, 0, 103, 242, 211, 20, 162, 225, 7,
			46, 201, 140, 184, 205,
		]),
	},
	pat: {
		addr: "3MMI7GS7YO6BVH2CDW6T7HIOXF2HTB4GL6PLZVU4E53DJVIOBXAA7J7XPE",
		sk: new Uint8Array([
			192, 206, 195, 253, 225, 210, 112, 235, 169, 76, 96, 199, 65, 186, 206, 53, 178, 246, 82,
			116, 170, 165, 174, 192, 16, 122, 16, 202, 12, 244, 136, 23, 219, 24, 143, 154, 95, 195,
			188, 26, 159, 66, 29, 189, 63, 157, 14, 185, 116, 121, 135, 134, 95, 158, 188, 214, 156,
			39, 118, 52, 213, 14, 13, 192,
		]),
	},
};
