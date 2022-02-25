import { parsing, types } from "@algo-builder/web";
import { encodeAddress, EncodedAssetParams, EncodedGlobalStateSchema, Transaction } from "algosdk";

import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Op } from "../interpreter/opcode";
import { TxFieldDefaults, TxnFields, ZERO_ADDRESS_STR } from "../lib/constants";
import { Context, EncTx, EncTxnType, RuntimeAccountI, StackElem, TxField, TxnType } from "../types";
import { convertToString } from "./parsing";

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
  return ((txn.type as string) === EncTxnType.acfg) && // type should be asset config
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
 * @param idx array index
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
  return txn.type === EncTxnType.acfg && // type should be asset config
    (txn.caid !== undefined && txn.caid !== 0) && // assetIndex should not be 0
    !(txn.apar?.m ?? txn.apar?.r ?? txn.apar?.f ?? txn.apar?.c); // fields should be empty
}

/**
 * Check if given encoded transaction obj is asset deletion
 * @param txn Encoded EncTx Object
 */
export function isEncTxAssetConfig (txn: EncTx): boolean {
  return txn.type === EncTxnType.acfg && // type should be asset config
    (txn.caid !== undefined && txn.caid !== 0) && // assetIndex should not be 0
    !isEncTxAssetDeletion(txn); // AND should not be asset deletion
}

/**
 * Check if given encoded transaction obj is appl creation
 * @param txn Encoded EncTx Object
 */
export function isEncTxApplicationCreate (txn: EncTx): boolean {
  return txn.type === EncTxnType.appl && (txn.apan === 0 || txn.apan === undefined);
}

/**
 *
 * @param txAndSign transaction and sign
 * @param ctx context which is tx and sign apply
 * @returns ExecParams object equivalent with txAndSign
 */
export function transactionAndSignToExecParams (
  txAndSign: types.TransactionAndSign, ctx: Context
): types.ExecParams {
  const transaction = txAndSign.transaction as any;
  const encTx = transaction.get_obj_for_encoding() as EncTx;
  // inject approval Program and clear program with string format.
  // TODO: should create function to convert TEAL in Uint8Array to string format?
  encTx.approvalProgram = transaction.approvalProgram;
  encTx.clearProgram = transaction.clearProgram;
  const sign = txAndSign.sign;
  return encTxToExecParams(encTx, sign, ctx);
}

/* eslint-disable sonarjs/cognitive-complexity */
export function encTxToExecParams (
  encTx: EncTx, sign: types.Sign, ctx: Context, line?: number
): types.ExecParams {
  const execParams: any = {
    ...sign,
    payFlags: {} as types.ExecParams
  };

  execParams.payFlags.totalFee = encTx.fee;

  switch (encTx.type) {
    case EncTxnType.appl: {
      if (isEncTxApplicationCreate(encTx)) {
        execParams.type = types.TransactionType.DeployApp;
        execParams.approvalProgram = encTx.approvalProgram;
        execParams.clearProgram = encTx.clearProgram;
        execParams.localInts = encTx.apgs?.nui;
        execParams.localBytes = encTx.apgs?.nbs;
        execParams.globalInts = encTx.apgs?.nui;
        execParams.globalBytes = encTx.apgs?.nbs;
      }
      break;
    }

    case EncTxnType.pay: {
      execParams.type = types.TransactionType.TransferAlgo;
      execParams.fromAccountAddr = _getAddress(encTx.snd);
      execParams.toAccountAddr =
        _getRuntimeAccountAddr(encTx.rcv, ctx, line) ?? ZERO_ADDRESS_STR;
      execParams.amountMicroAlgos = encTx.amt ?? 0n;
      if (encTx.close) {
        execParams.payFlags.closeRemainderTo = _getRuntimeAccountAddr(encTx.close, ctx, line);
      }
      if (encTx.rekey) {
        execParams.payFlags.rekeyTo = _getAddress(encTx.rekey);
      }
      break;
    }
    case EncTxnType.afrz: {
      execParams.type = types.TransactionType.FreezeAsset;
      execParams.assetID = encTx.faid;
      execParams.freezeTarget = _getRuntimeAccountAddr(encTx.fadd, ctx, line);
      execParams.freezeState = BigInt(encTx.afrz ?? 0n) === 1n;
      if (encTx.rekey) {
        execParams.payFlags.rekeyTo = _getAddress(encTx.rekey);
      }
      break;
    }
    case 'axfer': {
      if (encTx.asnd !== undefined) { // if 'AssetSender' is set, it is clawback transaction
        execParams.type = types.TransactionType.RevokeAsset;
        execParams.recipient =
          _getRuntimeAccountAddr(encTx.arcv, ctx, line) ?? ZERO_ADDRESS_STR;
        execParams.revocationTarget = _getRuntimeAccountAddr(encTx.asnd, ctx, line);
      } else { // asset transfer
        execParams.type = types.TransactionType.TransferAsset;
        execParams.toAccountAddr =
          _getRuntimeAccountAddr(encTx.arcv, ctx) ?? ZERO_ADDRESS_STR;
      }
      // set common fields (asset amount, index, closeRemainderTo)
      execParams.amount = encTx.aamt ?? 0n;
      execParams.assetID = encTx.xaid ?? 0;
      // option fields
      if (encTx.aclose) {
        execParams.payFlags.closeRemainderTo = _getRuntimeAccountAddr(encTx.aclose, ctx, line);
      }
      if (encTx.rekey) {
        execParams.payFlags.rekeyTo = _getAddress(encTx.rekey);
      }
      break;
    }

    case EncTxnType.acfg: {
      if (isEncTxAssetDeletion(encTx)) {
        execParams.type = types.TransactionType.DestroyAsset;
        execParams.assetID = encTx.caid;
      } else if (isEncTxAssetConfig(encTx)) {
        // from the docs: all fields must be reset, otherwise they will be cleared
        // https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/#asset-configuration
        execParams.type = types.TransactionType.ModifyAsset;
        execParams.assetID = encTx.caid;
        execParams.fields = {
          manager: _getASAConfigAddr(encTx.apar?.m),
          reserve: _getASAConfigAddr(encTx.apar?.r),
          clawback: _getASAConfigAddr(encTx.apar?.c),
          freeze: _getASAConfigAddr(encTx.apar?.f)
        };
      } else { // if not delete or modify, it's ASA deployment
        execParams.type = types.TransactionType.DeployASA;
        execParams.asaName = encTx.apar?.an;
        execParams.asaDef = {
          name: encTx.apar?.an,
          total: Number(encTx.apar?.t),
          decimals: encTx.apar?.dc !== undefined ? Number(encTx.apar.dc) : 0,
          defaultFrozen: BigInt(encTx.apar?.df ?? 0n) === 1n,
          unitName: encTx.apar?.un,
          url: encTx.apar?.au,
          metadataHash: encTx.apar?.am ? convertToString(encTx.apar?.am) : undefined,
          manager: _getASAConfigAddr(encTx.apar?.m),
          reserve: _getASAConfigAddr(encTx.apar?.r),
          clawback: _getASAConfigAddr(encTx.apar?.c),
          freeze: _getASAConfigAddr(encTx.apar?.f)
        };
      }
      break;
    }

    case EncTxnType.keyreg: {
      execParams.type = types.TransactionType.KeyRegistration;
      execParams.voteKey = encTx.votekey?.toString('base64');
      execParams.selectionKey = encTx.selkey?.toString('base64');
      execParams.voteFirst = encTx.votefst;
      execParams.voteLast = encTx.votelst;
      execParams.voteKeyDilution = encTx.votekd;
      break;
    }

    default: {
      // if line is defined => called from ItxnSubmit
      // => throw error with itxn_submit
      if (line) {
        throw new Error(`unsupported type for itxn_submit at line ${line}`);
      } else {
        throw new Error("Can't convert encode tx to execParams");
      }
    }
  };
  return execParams as types.ExecParams;
}

const _getASAConfigAddr = (addr?: Uint8Array): string => {
  if (addr) {
    return encodeAddress(addr);
  }
  return "";
};

const _getRuntimeAccount = (publickey: Buffer | undefined,
  ctx: Context, line?: number): RuntimeAccountI | undefined => {
  if (publickey === undefined) { return undefined; }
  const address = encodeAddress(Uint8Array.from(publickey));
  const runtimeAcc = ctx.getAccount(
    address
  );
  return runtimeAcc.account;
};

const _getRuntimeAccountAddr = (publickey: Buffer | undefined,
  ctx: Context, line?: number): types.AccountAddress | undefined => {
  return _getRuntimeAccount(publickey, ctx, line)?.addr;
};

const _getAddress = (addr?: Uint8Array): string | undefined => {
  if (addr) { return encodeAddress(addr); }
  return undefined;
};
