import { parsing } from "@algo-builder/web";
import type { AssetDefEnc, StateSchemaEnc, Transaction } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Op } from "../interpreter/opcode";
import { TxFieldDefaults, TxnFields } from "../lib/constants";
import { StackElem, TxField, Txn, TxnType } from "../types";

const assetTxnFields = new Set([
  'ConfigAssetTotal',
  'ConfigAssetDecimals',
  'ConfigAssetDefaultFrozen',
  'ConfigAssetUnitName',
  'ConfigAssetName',
  'ConfigAssetURL',
  'ConfigAssetMetadataHash',
  'ConfigAssetManager',
  'ConfigAssetReserve',
  'ConfigAssetFreeze',
  'ConfigAssetClawback'
]);

const globalAndLocalNumTxnFields = new Set([
  'GlobalNumUint', 'GlobalNumByteSlice',
  'LocalNumUint', 'LocalNumByteSlice'
]);

// return default value of txField if undefined,
// otherwise return parsed data to interpreter
export function parseToStackElem (a: unknown, field: TxField): StackElem {
  if (Buffer.isBuffer(a)) {
    return new Uint8Array(a);
  }
  if (typeof a === "number" || typeof a === "bigint") {
    return BigInt(a);
  }
  if (typeof a === "string") {
    return parsing.stringToBytes(a);
  }

  return TxFieldDefaults[field];
}

/**
 * Check if given transaction is asset deletion
 * @param txn Txn Object
 * Logic:
 * https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction
 * https://github.com/algorand/js-algorand-sdk/blob/e07d99a2b6bd91c4c19704f107cfca398aeb9619/src/transaction.ts#L528
 */
export function checkIfAssetDeletionTx (txn: Transaction): boolean {
  return txn.type === 'acfg' && // type should be asset config
  (txn.assetIndex > 0) && // assetIndex should not be 0
  !(txn.assetClawback || txn.assetFreeze || txn.assetManager || txn.assetReserve); // fields should be empty
}

/**
 * Description: returns specific transaction field value from tx object
 * @param txField: transaction field
 * @param tx Current transaction
 * @param txns Transaction group
 * @param tealVersion version of TEAL
 */
export function txnSpecbyField (txField: string, tx: Txn, gtxns: Txn[], tealVersion: number): StackElem {
  let result; // store raw result, parse and return

  // handle nested encoded obj (for AssetDef, AppGlobalNumFields, AppLocalNumFields)
  if (assetTxnFields.has(txField)) {
    const s = TxnFields[tealVersion][txField];
    const assetMetaData = tx.apar;
    result = assetMetaData?.[s as keyof AssetDefEnc];
    return parseToStackElem(result, txField);
  }
  if (globalAndLocalNumTxnFields.has(txField)) {
    const encAppGlobalSchema = txField.includes('Global') ? tx.apgs : tx.apls;
    const s = TxnFields[tealVersion][txField];
    result = encAppGlobalSchema?.[s as keyof StateSchemaEnc];
    return parseToStackElem(result, txField);
  }

  // handle other cases
  switch (txField) {
    case 'FirstValidTime': { // Causes program to fail; reserved for future use
      throw new RuntimeError(RUNTIME_ERRORS.TEAL.REJECTED_BY_LOGIC);
    }
    case 'TypeEnum': {
      result = Number(TxnType[tx.type as keyof typeof TxnType]); // TxnType['pay']
      break;
    }
    case 'TxID': {
      return parsing.stringToBytes(tx.txID);
    }
    case 'GroupIndex': {
      result = gtxns.indexOf(tx);
      break;
    }
    case 'NumAppArgs': {
      const appArg = TxnFields[tealVersion].ApplicationArgs as keyof Txn;
      const appArgs = tx[appArg] as Buffer[];
      result = appArgs?.length;
      break;
    }
    case 'NumAccounts': {
      const appAcc = TxnFields[tealVersion].Accounts as keyof Txn;
      const appAccounts = tx[appAcc] as Buffer[];
      result = appAccounts?.length;
      break;
    }
    case 'NumAssets': {
      const encAppAsset = TxnFields[tealVersion].Assets as keyof Txn; // 'apas'
      const foreignAssetsArr = tx[encAppAsset] as Buffer[];
      result = foreignAssetsArr?.length;
      break;
    }
    case 'NumApplications': {
      const encApp = TxnFields[tealVersion].Applications as keyof Txn; // 'apfa'
      const foreignAppsArr = tx[encApp] as Buffer[];
      result = foreignAppsArr?.length;
      break;
    }
    default: {
      const s = TxnFields[tealVersion][txField]; // eg: rcv = TxnFields["Receiver"]
      result = tx[s as keyof Txn]; // pk_buffer = tx['rcv']
    }
  }

  return parseToStackElem(result, txField);
}

/**
 * Returns specific transaction field value from array
 * of accounts or application args
 * @param tx current transaction
 * @param txField transaction field
 * @param idx array index
 * @param op Op object
 * @param tealVersion version of TEAL
 * @param line line number in TEAL file
 */
export function txAppArg (txField: TxField, tx: Txn, idx: number, op: Op,
  tealVersion: number, line: number): StackElem {
  const s = TxnFields[tealVersion][txField]; // 'apaa' or 'apat'
  const result = tx[s as keyof Txn] as Buffer[]; // array of pk buffers (accounts or appArgs)
  if (!result) { // handle defaults
    return TxFieldDefaults[txField];
  }

  /**
   * handle special case of accounts and applications:
   * + Txn.Accounts[0] represents sender's account
   * + Txn.Applications[0] represents current_application_id
   * https://pyteal.readthedocs.io/en/stable/accessing_transaction_field.html#special-case-txn-accounts-and-txn-applications
   */
  if (txField === 'Accounts') {
    if (idx === 0) { return parseToStackElem(tx.snd, txField); }
    idx--; // if not sender, then reduce index by 1
  } else if (txField === 'Applications') {
    if (idx === 0) { return parseToStackElem(tx.apid ?? 0n, txField); } // during ssc deploy tx.app_id is 0
    idx--;
  }
  op.checkIndexBound(idx, result, line);
  return parseToStackElem(result[idx], txField);
}
