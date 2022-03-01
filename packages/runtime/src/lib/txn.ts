import { parsing } from "@algo-builder/web";
import { EncodedAssetParams, EncodedGlobalStateSchema, Transaction } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Op } from "../interpreter/opcode";
import { TxFieldDefaults, TxnFields } from "../lib/constants";
import { EncTx, StackElem, TxField, TxnType } from "../types";

export const assetTxnFields = new Set([
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
  if (typeof a === "number" || typeof a === "bigint" || typeof a === "boolean") {
    return BigInt(a);
  }
  if (typeof a === "string") {
    return parsing.stringToBytes(a);
  }

  return TxFieldDefaults[field];
}

/**
 * Check if given transaction is asset deletion
 * @param txn EncTx Object
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
export function txnSpecbyField (txField: string, tx: EncTx, gtxns: EncTx[], tealVersion: number): StackElem {
  let result; // store raw result, parse and return

  // handle nested encoded obj (for AssetDef, AppGlobalNumFields, AppLocalNumFields)
  if (assetTxnFields.has(txField)) {
    const s = TxnFields[tealVersion][txField];
    const assetMetaData = tx.apar;
    result = assetMetaData?.[s as keyof EncodedAssetParams];
    return parseToStackElem(result, txField);
  }
  if (globalAndLocalNumTxnFields.has(txField)) {
    const encAppGlobalSchema = txField.includes('Global') ? tx.apgs : tx.apls;
    const s = TxnFields[tealVersion][txField];
    result = encAppGlobalSchema?.[s as keyof EncodedGlobalStateSchema];
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
      const appArg = TxnFields[tealVersion].ApplicationArgs as keyof EncTx;
      const appArgs = tx[appArg] as Buffer[];
      result = appArgs?.length;
      break;
    }
    case 'NumAccounts': {
      const appAcc = TxnFields[tealVersion].Accounts as keyof EncTx;
      const appAccounts = tx[appAcc] as Buffer[];
      result = appAccounts?.length;
      break;
    }
    case 'NumAssets': {
      const encAppAsset = TxnFields[tealVersion].Assets as keyof EncTx; // 'apas'
      const foreignAssetsArr = tx[encAppAsset] as Buffer[];
      result = foreignAssetsArr?.length;
      break;
    }
    case 'NumApplications': {
      const encApp = TxnFields[tealVersion].Applications as keyof EncTx; // 'apfa'
      const foreignAppsArr = tx[encApp] as Buffer[];
      result = foreignAppsArr?.length;
      break;
    }
    case 'AssetSender': {
      /// + for asset_transfer transactions, we use "snd"
      /// + for revoke asset tx (also an asset_transfer) tx, we use "asnd"
      if (tx.type === 'axfer') { result = tx.asnd ?? tx.snd; }
      break;
    }
    default: {
      const s = TxnFields[tealVersion][txField]; // eg: rcv = TxnFields["Receiver"]
      result = tx[s as keyof EncTx]; // pk_buffer = tx['rcv']
    }
  }

  return parseToStackElem(result, txField);
}

/**
 * Returns specific transaction field value from array
 * of accounts or application args
 * @param tx current transaction
 * @param txField transaction field
 * @param idx index in EncodedTransaction[txField]
 * @param op Op object
 * @param tealVersion version of TEAL
 * @param line line number in TEAL file
 */
export function txAppArg (txField: TxField, tx: EncTx, idx: number, op: Op,
  tealVersion: number, line: number): StackElem {
  const s = TxnFields[tealVersion][txField]; // 'apaa' or 'apat'
  const result = tx[s as keyof EncTx] as Buffer[]; // array of pk buffers (accounts or appArgs)
  if (!result) { // handle defaults
    return TxFieldDefaults[txField];
  }

  /**
   * handle special case of accounts and applications:
   * + EncTx.Accounts[0] represents sender's account
   * + EncTx.Applications[0] represents current_application_id
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

/**
 * Check if given encoded transaction obj is asset deletion
 * @param txn Encoded EncTx Object
 * Logic:
 * https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction
 * https://github.com/algorand/js-algorand-sdk/blob/e07d99a2b6bd91c4c19704f107cfca398aeb9619/src/transaction.ts#L528
 */
export function isEncTxAssetDeletion (txn: EncTx): boolean {
  return txn.type === 'acfg' && // type should be asset config
    (txn.caid !== undefined && txn.caid !== 0) && // assetIndex should not be 0
    !(txn.apar?.m ?? txn.apar?.r ?? txn.apar?.f ?? txn.apar?.c); // fields should be empty
}

/**
 * Check if given encoded transaction obj is asset deletion
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetConfig (txn: EncTx): boolean {
  return txn.type === 'acfg' && // type should be asset config
    (txn.caid !== undefined && txn.caid !== 0) && // assetIndex should not be 0
    !isEncTxAssetDeletion(txn); // AND should not be asset deletion
}
