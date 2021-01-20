import { AssetDefEnc } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { Op } from "../interpreter/opcode";
import { TxFieldDefaults, TxnFields } from "../lib/constants";
import { stringToBytes } from "../lib/parsing";
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

// return default value of txField if undefined,
// otherwise return parsed data to interpreter
export function parseToStackElem (a: unknown, field: TxField): StackElem {
  if (Buffer.isBuffer(a)) {
    return new Uint8Array(a);
  }
  if (typeof a === "number") {
    return BigInt(a);
  }
  if (typeof a === "string") {
    return stringToBytes(a);
  }

  return TxFieldDefaults[field];
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

  // handle nested encoded obj (for AssetDef)
  if (assetTxnFields.has(txField)) {
    const s = TxnFields[tealVersion][txField];
    const assetMetaData = tx.apar;
    result = assetMetaData[s as keyof AssetDefEnc];
    return parseToStackElem(result, txField);
  }

  // handle other cases
  switch (txField) {
    case 'FirstValidTime': { // Causes program to fail; reserved for future use
      throw new TealError(ERRORS.TEAL.REJECTED_BY_LOGIC);
    }
    case 'TypeEnum': {
      result = Number(TxnType[tx.type as keyof typeof TxnType]); // TxnType['pay']
      break;
    }
    case 'TxID': {
      return stringToBytes(tx.txID);
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
  tealVersion: number, line: number): Uint8Array {
  if (txField === 'Accounts' || txField === 'ApplicationArgs') {
    const s = TxnFields[tealVersion][txField]; // 'apaa' or 'apat'
    const result = tx[s as keyof Txn] as Buffer[]; // array of pk buffers (accounts or appArgs)

    if (!result) { // handle
      return TxFieldDefaults[txField];
    }
    op.checkIndexBound(idx, result, line);
    return parseToStackElem(result[idx], txField) as Uint8Array;
  }

  throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
    opcode: "txna or gtxna"
  });
}
