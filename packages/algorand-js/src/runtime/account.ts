import { SSCDeploymentFlags } from "@algorand-builder/algob/src/types";
import type {
  Account,
  AssetDef,
  AssetHolding,
  SSCSchemaConfig
} from "algosdk";
import { generateAccount } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { assertValidSchema } from "../lib/stateful";
import { AppLocalStateM, CreatedAppM, SSCAttributesM, StackElem, StoreAccountI } from "../types";

const StateMap = "key-value";
export class StoreAccount implements StoreAccountI {
  readonly account: Account;
  readonly address: string;
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
   * Description: fetches local state value for key present in account
   * returns undefined otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   */
  getLocalState (appId: number, key: Uint8Array): StackElem | undefined {
    const localState = this.appsLocalState;
    const data = localState.get(appId)?.[StateMap]; // can be undefined (eg. app opted in)
    return data?.get(key.toString());
  }

  /**
   * Description: add new key-value pair or updating pair with existing key in account
   * for application id: appId, throw error otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   * @param value: key to fetch value of from local state
   */
  setLocalState (appId: number, key: Uint8Array, value: StackElem): AppLocalStateM {
    const localState = this.appsLocalState.get(appId);
    const localApp = localState?.[StateMap];
    if (localState && localApp) {
      localApp.set(key.toString(), value);
      localState[StateMap] = localApp; // save updated state

      assertValidSchema(localState[StateMap], localState.schema); // verify if updated schema is valid by config
      return localState;
    }

    throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, {
      appId: appId
    });
  }

  // add application in account's state
  addApp (appId: number, params: SSCDeploymentFlags): CreatedAppM {
    if (this.createdApps.size === 10) {
      throw new Error('Maximum created applications for an account is 10');
    }

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

      // create new local app attribute
      const localParams: AppLocalStateM = {
        id: appId,
        "key-value": new Map<string, StackElem>(),
        schema: appParams["local-state-schema"]
      };
      this.appsLocalState.set(appId, localParams);
    }
  }

  // delete application from account's state
  deleteApp (appId: number): void {
    if (!this.createdApps.has(appId)) {
      throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, { appId: appId });
    }
    this.createdApps.delete(appId);
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
