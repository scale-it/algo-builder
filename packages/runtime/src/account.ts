import type {
  Account,
  AssetDef,
  AssetHolding,
  SSCSchemaConfig
} from "algosdk";
import { generateAccount } from "algosdk";

import { TealError } from "./errors/errors";
import { ERRORS } from "./errors/errors-list";
import { ALGORAND_ACCOUNT_MIN_BALANCE, APPLICATION_BASE_FEE, SSC_KEY_BYTE_SLICE, SSC_VALUE_BYTES, SSC_VALUE_UINT } from "./lib/constants";
import { keyToBytes } from "./lib/parsing";
import { assertValidSchema } from "./lib/stateful";
import { AppLocalStateM, CreatedAppM, SSCAttributesM, SSCDeploymentFlags, StackElem, StoreAccountI } from "./types";

const StateMap = "key-value";
const globalState = "global-state";
const localStateSchema = "local-state-schema";

export class StoreAccount implements StoreAccountI {
  readonly account: Account;
  readonly address: string;
  minBalance: number; // required minimum balance for account
  assets: Map<number, AssetHolding>;
  amount: number;
  appsLocalState: Map<number, AppLocalStateM>;
  appsTotalSchema: SSCSchemaConfig;
  createdApps: Map<number, SSCAttributesM>;
  createdAssets: Map<number, AssetDef>;

  constructor (balance: number, account?: Account) {
    if (account) {
      // set config if account is passed by user
      this.account = account;
      this.address = account.addr;
    } else {
      // generate new account if not passed by user
      this.account = generateAccount();
      this.address = this.account.addr;
    }

    this.assets = new Map<number, AssetHolding>();
    this.amount = balance;
    this.minBalance = ALGORAND_ACCOUNT_MIN_BALANCE;
    this.appsLocalState = new Map<number, AppLocalStateM>();
    this.appsTotalSchema = <SSCSchemaConfig>{};
    this.createdApps = new Map<number, SSCAttributesM>();
    this.createdAssets = new Map<number, AssetDef>();
  }

  // returns account balance in microAlgos
  balance (): number {
    return this.amount;
  }

  /**
   * Fetches local state value for key present in account
   * returns undefined otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getLocalState (appId: number, key: Uint8Array | string): StackElem | undefined {
    const localState = this.appsLocalState;
    const data = localState.get(appId)?.[StateMap]; // can be undefined (eg. app opted in)
    const localKey = keyToBytes(key);
    return data?.get(localKey.toString());
  }

  /**
   * Set new key-value pair or update pair with existing key in account
   * for application id: appId, throw error otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   * @param value: value of key to put in local state
   * @param line line number in TEAL file
   * Note: if user is accessing this function directly through runtime,
   * then line number is unknown
   */
  setLocalState (appId: number, key: Uint8Array | string, value: StackElem, line?: number): AppLocalStateM {
    const lineNumber = line ?? 'unknown';
    const localState = this.appsLocalState.get(appId);
    const localApp = localState?.[StateMap];
    if (localState && localApp) {
      const localKey = keyToBytes(key);
      localApp.set(localKey.toString(), value);
      localState[StateMap] = localApp; // save updated state

      assertValidSchema(localState[StateMap], localState.schema); // verify if updated schema is valid by config
      return localState;
    }

    throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, {
      appId: appId,
      line: lineNumber
    });
  }

  /**
   * Queries app global state value. Returns `undefined` if the key is not present.
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getGlobalState (appId: number, key: Uint8Array | string): StackElem | undefined {
    const app = this.getApp(appId);
    if (!app) return undefined;
    const appGlobalState = app[globalState];
    const globalKey = keyToBytes(key);
    return appGlobalState.get(globalKey.toString());
  }

  /**
   * Updates app global state.
   * Throws error if app is not found.
   * @param appId: application id
   * @param key: app global state key
   * @param value: value associated with a key
   */
  setGlobalState (appId: number, key: Uint8Array | string, value: StackElem, line?: number): void {
    const app = this.getApp(appId);
    if (app === undefined) throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId, line: line ?? 'unknown' });
    const appGlobalState = app[globalState];
    const globalKey = keyToBytes(key);
    appGlobalState.set(globalKey.toString(), value); // set new value in global state
    app[globalState] = appGlobalState; // save updated state

    assertValidSchema(app[globalState], app["global-state-schema"]); // verify if updated schema is valid by config
  }

  /**
   * Queries application by application index from account's global state.
   * Returns undefined if app is not found.
   * @param appId application index
   */
  getApp (appId: number): SSCAttributesM | undefined {
    return this.createdApps.get(appId);
  }

  /**
   * Queries application by application index from account's local state.
   * Returns undefined if app is not found.
   * @param appId application index
   */
  getAppFromLocal (appId: number): AppLocalStateM | undefined {
    return this.appsLocalState.get(appId);
  }

  /**
   * Add application in account's state
   * check maximum account creation limit
   * @param appId application index
   * @param params SSCDeployment Flags
   */
  addApp (appId: number, params: SSCDeploymentFlags): CreatedAppM {
    if (this.createdApps.size === 10) {
      throw new Error('Maximum created applications for an account is 10');
    }

    // raise minimum balance
    // https://developer.algorand.org/docs/features/asc1/stateful/#minimum-balance-requirement-for-a-smart-contract
    this.minBalance += (
      APPLICATION_BASE_FEE +
      (SSC_KEY_BYTE_SLICE + SSC_VALUE_UINT) * params.globalInts +
      (SSC_KEY_BYTE_SLICE + SSC_VALUE_BYTES) * params.globalBytes
    );
    const app = new App(appId, params);
    this.createdApps.set(app.id, app.attributes);
    return app;
  }

  // opt in to application
  optInToApp (appId: number, appParams: SSCAttributesM): void {
    const localState = this.appsLocalState.get(appId); // fetch local state from account
    if (localState) {
      console.warn(`${this.address} is already opted in to app ${appId}`);
    } else {
      if (this.appsLocalState.size === 10) {
        throw new Error('Maximum Opt In applications per account is 10');
      }

      // https://developer.algorand.org/docs/features/asc1/stateful/#minimum-balance-requirement-for-a-smart-contract
      this.minBalance += (
        APPLICATION_BASE_FEE +
        (SSC_KEY_BYTE_SLICE + SSC_VALUE_UINT) * appParams[localStateSchema]["num-uint"] +
        (SSC_KEY_BYTE_SLICE + SSC_VALUE_BYTES) * appParams[localStateSchema]["num-byte-slice"]
      );

      // create new local app attribute
      const localParams: AppLocalStateM = {
        id: appId,
        "key-value": new Map<string, StackElem>(),
        schema: appParams[localStateSchema]
      };
      this.appsLocalState.set(appId, localParams);
    }
  }

  // delete application from account's global state (createdApps)
  deleteApp (appId: number): void {
    if (!this.createdApps.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    this.createdApps.delete(appId);
  }

  // close(delete) application from account's local state (appsLocalState)
  closeApp (appId: number): void {
    if (!this.appsLocalState.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId, line: 'unknown' });
    }
    this.appsLocalState.delete(appId);
  }
}

// represents stateful application
class App {
  readonly id: number;
  readonly attributes: SSCAttributesM;

  constructor (appId: number, params: SSCDeploymentFlags) {
    this.id = appId;
    this.attributes = {
      'approval-program': '',
      'clear-state-program': '',
      creator: params.sender.addr,
      'global-state': new Map<string, StackElem>(),
      'global-state-schema': { 'num-byte-slice': params.globalBytes, 'num-uint': params.globalInts },
      'local-state-schema': { 'num-byte-slice': params.localBytes, 'num-uint': params.localInts }
    };
  }
}
