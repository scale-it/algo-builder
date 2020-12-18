/* eslint sonarjs/no-duplicate-string: 0 */
import { toBytes } from "algob";
import { AccountState, AppLocalState, SSCSchemaConfig, SSCStateSchema } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { compareArray } from "../lib/compare";
import { StackElem } from "../types";
import { Interpreter } from "./interpreter";

// returns new key value pair by setting type and corresponding values
function getKeyValPair (key: Uint8Array, value: StackElem): SSCStateSchema {
  let val;
  if (typeof value !== "bigint") {
    val = { type: 1, bytes: value, uint: 0 };
  } else {
    val = { type: 2, bytes: toBytes(''), uint: Number(value) };
  }

  return {
    key: key,
    value: val
  };
}

// TODO: to be moved to AccountState class
/**
 * Description: assert if the given key-value pairs are valid by schema
 * @param keyValue: list of key-value pairs (state data)
 * @param schema: permissible local/global state schema
 */
function assertValidSchema (keyValue: SSCStateSchema[], schema: SSCSchemaConfig): void {
  let numUint = 0; let byteSlices = 0;
  for (const k of keyValue) {
    k.value.type === 1 ? byteSlices++ : numUint++;
  }
  if (numUint > schema["num-uint"] || byteSlices > schema["num-byte-slice"]) {
    throw new TealError(ERRORS.TEAL.INVALID_SCHEMA);
  }
}

/**
 * Description: fetches local state value for key present in account
 * returns undefined otherwise
 * @param appId: current application id
 * @param account: account having local state data
 * @param key: key to fetch value of from local state
 */
export function getLocalState (appId: number, account: AccountState, key: Uint8Array): StackElem | undefined {
  const localState = account["apps-local-state"];
  const data = localState.find(state => state.id === appId)?.["key-value"]; // can be undefined (eg. app opted in)
  if (data) {
    const keyValue = data.find(schema => compareArray(schema.key, key));
    const value = keyValue?.value;
    if (value) {
      return value?.bytes || BigInt(value?.uint);
    }
  }
  return undefined;
}

// TODO: to be moved to Runtime class
/**
 * Description: fetches global state value for key present app's global data
 * returns undefined otherwise
 * @param appId: current application id
 * @param key: key to fetch value of from local state
 * @param interpreter: interpreter object
 */
export function getGlobalState (appId: number, key: Uint8Array,
  interpreter: Interpreter): StackElem | undefined {
  const appDelta = interpreter.globalApps.get(appId);
  if (!appDelta) {
    throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, {
      appId: appId
    });
  }
  const globalState = appDelta["global-state"];

  const keyValue = globalState.find(schema => compareArray(schema.key, key));
  const value = keyValue?.value;
  if (value) {
    return value?.bytes || BigInt(value?.uint);
  }
  return undefined;
}

// TODO: to be moved to AccountState class
/**
 * Description: add new key-value pair or updating pair with existing key in account
 * for application id: appId, throw error otherwise
 * @param appId: current application id
 * @param account: account having local state data
 * @param key: key to fetch value of from local state
 * @param value: key to fetch value of from local state
 */
export function updateLocalState (appId: number, account: AccountState,
  key: Uint8Array, value: StackElem): AppLocalState[] {
  const localState = account["apps-local-state"];
  const data = getKeyValPair(key, value); // key value pair to put

  for (const l of localState) {
    if (l.id === appId) { // find appId
      const localDelta = l["key-value"];
      const idx = localDelta.findIndex(schema => compareArray(schema.key, key));

      if (idx === -1) {
        localDelta.push(data); // push new pair if key not found
      } else {
        localDelta[idx].value = data.value; // update value if key found
      }
      l["key-value"] = localDelta; // save updated state

      assertValidSchema(l["key-value"], l.schema); // verify if updated schema is valid by config
      return localState;
    }
  }

  throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, {
    appId: appId
  });
}

// TODO: to be moved to Runtime class
/**
 * Description: add new key-value pair or updating pair with existing key in
 * app's global data for application id: appId, throw error otherwise
 * @param appId: current application id
 * @param key: key to fetch value of from local state
 * @param value: key to fetch value of from local state
 * @param interpreter: interpreter object
 */
export function updateGlobalState (appId: number, key: Uint8Array,
  value: StackElem, interpreter: Interpreter): SSCStateSchema[] {
  const appDelta = interpreter.globalApps.get(appId);
  if (!appDelta) {
    throw new TealError(ERRORS.TEAL.APP_NOT_FOUND, {
      appId: appId
    });
  }

  const globalState = appDelta["global-state"];
  const data = getKeyValPair(key, value); // key value pair to put
  const idx = globalState.findIndex(schema => compareArray(schema.key, key));
  if (idx === -1) {
    globalState.push(data); // push new pair if key not found
  } else {
    globalState[idx].value = data.value; // update value if key found
  }
  appDelta["global-state"] = globalState; // save updated state

  assertValidSchema(appDelta["global-state"], appDelta["global-state-schema"]); // verify if updated schema is valid by config
  return globalState;
}
