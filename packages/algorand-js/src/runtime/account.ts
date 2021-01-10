import { SSCDeploymentFlags } from "@algorand-builder/algob/src/types";
import type {
  Account,
  AppLocalState,
  AssetHolding,
  CreatedApp,
  CreatedAssets, SSCAttributes, SSCSchemaConfig
} from "algosdk";
import { generateAccount } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { compareArray } from "../lib/compare";
import { SSC_BYTES } from "../lib/constants";
import { assertValidSchema, getKeyValPair } from "../lib/stateful";
import { StackElem, StoreAccount } from "../types";

export class StoreAccountImpl implements StoreAccount {
  readonly account: Account;
  readonly address: string;
  assets: AssetHolding[]; // TODO: to be removed
  amount: number;
  appsLocalState: AppLocalState[]; // TODO: update to map
  appsTotalSchema: SSCSchemaConfig;
  createdApps: CreatedApp[];
  createdAssets: CreatedAssets[];

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

    this.assets = [];
    this.amount = balance;
    this.appsLocalState = [];
    this.appsTotalSchema = <SSCSchemaConfig>{};
    this.createdApps = [];
    this.createdAssets = [];
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
    const data = localState.find(state => state.id === appId)?.["key-value"]; // can be undefined (eg. app opted in)
    if (data) {
      const keyValue = data.find(schema => compareArray(schema.key, key));
      const value = keyValue?.value;
      if (value) {
        return value.type === SSC_BYTES ? value.bytes : BigInt(value.uint);
      }
    }
    return undefined;
  }

  /**
   * Description: add new key-value pair or updating pair with existing key in account
   * for application id: appId, throw error otherwise
   * @param appId: current application id
   * @param key: key to fetch value of from local state
   * @param value: key to fetch value of from local state
   */
  updateLocalState (appId: number, key: Uint8Array, value: StackElem): AppLocalState[] {
    const localState = this.appsLocalState;
    const data = getKeyValPair(key, value); // key value pair to put

    for (const l of localState) {
      if (l.id === appId) { // find appId
        const localApp = l["key-value"];
        const idx = localApp.findIndex(schema => compareArray(schema.key, key));

        if (idx === -1) {
          localApp.push(data); // push new pair if key not found
        } else {
          localApp[idx].value = data.value; // update value if key found
        }
        l["key-value"] = localApp; // save updated state

        assertValidSchema(l["key-value"], l.schema); // verify if updated schema is valid by config
        return localState;
      }
    }

    throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, {
      appId: appId
    });
  }

  addApp (appId: number, params: SSCDeploymentFlags): CreatedApp {
    if (this.createdApps.length === 10) {
      throw new Error('Maximum created applications for an account is 10');
    }

    const app = new App(appId, params);
    this.createdApps.push(app);
    return app;
  }

  // opt in to application
  optInToApp (appId: number, appParams: SSCAttributes): void {
    const localState = this.appsLocalState.find(app => app.id === appId);
    if (localState) {
      console.warn(`${this.address} is already opted in to app ${appId}`);
    } else {
      if (this.appsLocalState.length === 10) {
        throw new Error('Maximum Opt In applications per account is 10');
      }

      const localParams: AppLocalState = {
        id: appId,
        "key-value": [],
        schema: appParams["local-state-schema"]
      };
      this.appsLocalState.push(localParams); // push
    }
  }
}

// represents stateful application
class App {
  readonly id: number;
  readonly params: SSCAttributes;

  constructor (appId: number, params: SSCDeploymentFlags) {
    this.id = appId;
    this.params = {
      'approval-program': '',
      'clear-state-program': '',
      creator: params.sender.addr,
      'global-state': [],
      'global-state-schema': { 'num-byte-slice': params.globalBytes, 'num-uint': params.globalInts },
      'local-state-schema': { 'num-byte-slice': params.localBytes, 'num-uint': params.localInts }
    };
  }
}
