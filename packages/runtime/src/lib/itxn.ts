import { types } from "@algo-builder/web";
import { decodeAddress, encodeAddress } from "algosdk";

import { Interpreter } from "..";
import { RUNTIME_ERRORS } from "../errors/errors-list";
import { RuntimeError } from "../errors/runtime-errors";
import { Op } from "../interpreter/opcode";
import { TxnFields, TxnTypeMap, ZERO_ADDRESS_STR } from "../lib/constants";
import { AccountAddress, RuntimeAccount, StackElem, Txn } from "../types";
import { convertToString } from "./parsing";
import { assetTxnFields, isEncTxAssetConfig, isEncTxAssetDeletion } from "./txn";

const uintTxnFields = new Set([
  'Fee', 'Amount', 'AssetAmount', 'TypeEnum', 'FreezeAssetFrozen',
  'ConfigAssetTotal', 'ConfigAssetDecimals',
  'ConfigAssetDefaultFrozen'
]);

// these are also uint values, but require that the asset
// be present in Txn.Assets[] array
const assetIDFields = new Set([
  'XferAsset', 'FreezeAsset', 'ConfigAsset'
]);

const byteTxnFields = new Set([
  'Type', 'ConfigAssetName', 'ConfigAssetUnitName',
  'ConfigAssetMetadataHash', 'ConfigAssetURL'
]);

const addrTxnFields = new Set([
  'Sender', 'Receiver', 'CloseRemainderTo', 'AssetSender', 'AssetCloseTo',
  'AssetReceiver', 'FreezeAssetAccount', 'ConfigAssetManager',
  'ConfigAssetReserve', 'ConfigAssetFreeze', 'ConfigAssetClawback'
]);

/**
 * Sets inner transaction field to subTxn (eg. set assetReceiver('rcv'))
 * https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/#setting-transaction-properties
 */
/* eslint-disable sonarjs/cognitive-complexity */
export function setInnerTxField (
  subTxn: Txn, field: string, val: StackElem,
  op: Op, interpreter: Interpreter, line: number): Txn {
  let txValue: bigint | number | string | Uint8Array | undefined;
  if (uintTxnFields.has(field)) {
    txValue = op.assertBigInt(val, line);
  }

  if (assetIDFields.has(field)) {
    const id = op.assertBigInt(val, line);
    txValue = interpreter.getAssetIDByReference(Number(id), false, line, op);
  }

  if (byteTxnFields.has(field)) {
    const assertedVal = op.assertBytes(val, line);
    txValue = convertToString(assertedVal);
  }

  if (addrTxnFields.has(field)) {
    const assertedVal = op.assertBytes(val, line);
    const accountState = interpreter.getAccount(assertedVal, line);
    txValue = Buffer.from(decodeAddress(accountState.address).publicKey);
  }

  const encodedField = TxnFields[interpreter.tealVersion][field]; // eg 'rcv'

  // txValue can be undefined for a field with not having TEALv5 support (eg. type 'appl')
  if (txValue === undefined) {
    throw new RuntimeError(
      RUNTIME_ERRORS.TEAL.ITXN_FIELD_ERR, {
        msg: `Field ${field} is invalid`,
        field: field,
        line: line,
        tealV: interpreter.tealVersion
      });
  }

  // handle individual cases
  let errMsg = "";
  switch (field) {
    case 'Type': {
      const txType = txValue as string;
      // either invalid string, or not allowed for TEALv5
      if (
        txType !== 'pay' && txType !== 'axfer' && txType !== 'acfg' && txType !== 'afrz'
      ) {
        errMsg = `Type does not represent 'pay', 'axfer', 'acfg' or 'afrz'`;
      }
      break;
    }
    case 'TypeEnum': {
      const txType = op.assertBigInt(val, line);
      if (TxnTypeMap[Number(txType)] === undefined) {
        errMsg = `TypeEnum does not represent 'pay', 'axfer', 'acfg' or 'afrz'`;
      }

      subTxn.type = TxnTypeMap[Number(txType)];
      break;
    }
    case 'ConfigAssetDecimals': {
      const assetDecimals = txValue as bigint;
      if (assetDecimals > 19n || assetDecimals < 0n) {
        errMsg = "Decimals must be between 0 (non divisible) and 19";
      }
      break;
    }
    case 'ConfigAssetMetadataHash': {
      const assetMetadataHash = txValue as string;
      if (assetMetadataHash.length !== 32) {
        errMsg = "assetMetadataHash must be a 32 byte Uint8Array or string.";
      }
      break;
    }
    case 'ConfigAssetUnitName': {
      const assetUnitName = txValue as string;
      if (assetUnitName.length > 8) {
        errMsg = "Unit name must not be longer than 8 bytes";
      }
      break;
    }
    case 'ConfigAssetName': {
      const assetName = txValue as string;
      if (assetName.length > 32) {
        errMsg = "AssetName must not be longer than 8 bytes";
      }
      break;
    }
    case 'ConfigAssetURL': {
      const assetURL = txValue as string;
      if (assetURL.length > 96) {
        errMsg = "URL must not be longer than 96 bytes";
      }
      break;
    }
    default: { break; }
  }

  if (errMsg) {
    throw new RuntimeError(
      RUNTIME_ERRORS.TEAL.ITXN_FIELD_ERR, {
        msg: errMsg,
        field: field,
        line: line,
        tealV: interpreter.tealVersion
      });
  }

  // if everything goes well, set the [key, value]
  if (encodedField === null) {
    return subTxn; // could be for "TypeEnum"
  } else if (assetTxnFields.has(field)) {
    (subTxn as any).apar = (subTxn as any).apar ?? {};
    (subTxn as any).apar[encodedField] = txValue;
  } else {
    (subTxn as any)[encodedField] = txValue;
  }

  return subTxn;
}

const _getRuntimeAccount = (publickey: Buffer | undefined,
  interpreter: Interpreter, line: number): RuntimeAccount | undefined => {
  if (publickey === undefined) { return undefined; }
  const address = encodeAddress(Uint8Array.from(publickey));
  const runtimeAcc = interpreter.runtime.assertAccountDefined(
    address,
    interpreter.runtime.ctx.state.accounts.get(address),
    line
  );
  return runtimeAcc.account;
};

const _getRuntimeAccountAddr = (publickey: Buffer | undefined,
  interpreter: Interpreter, line: number): AccountAddress | undefined => {
  return _getRuntimeAccount(publickey, interpreter, line)?.addr;
};

// parse encoded txn obj to execParams (params passed by user in algob)
/* eslint-disable sonarjs/cognitive-complexity */
export function parseEncodedTxnToExecParams (tx: Txn,
  interpreter: Interpreter, line: number): types.ExecParams {
  // initial common fields
  const execParams: any = {
    sign: types.SignType.SecretKey,
    fromAccount: _getRuntimeAccount(tx.snd, interpreter, line), // sender is the contract
    payFlags: {
      totalFee: tx.fee,
      firstValid: tx.fv
    }
  };

  switch (tx.type) {
    case 'pay': {
      execParams.type = types.TransactionType.TransferAlgo;
      execParams.toAccountAddr =
        _getRuntimeAccountAddr(tx.rcv as Buffer, interpreter, line) ?? ZERO_ADDRESS_STR;
      execParams.amountMicroAlgos = tx.amt ?? 0n;
      execParams.payFlags.closeRemainderTo = _getRuntimeAccountAddr(tx.close as Buffer, interpreter, line);
      break;
    }
    case 'afrz': {
      execParams.type = types.TransactionType.FreezeAsset;
      execParams.assetID = tx.faid;
      execParams.freezeTarget = _getRuntimeAccountAddr(tx.fadd as Buffer, interpreter, line);
      execParams.freezeState = BigInt(tx.afrz ?? 0n) === 1n;
      break;
    }
    case 'axfer': {
      if (tx.asnd !== undefined) { // if 'AssetSender' is set, it is clawback transaction
        execParams.type = types.TransactionType.RevokeAsset;
        execParams.recipient =
          _getRuntimeAccountAddr(tx.arcv as Buffer, interpreter, line) ?? ZERO_ADDRESS_STR;
        execParams.revocationTarget = _getRuntimeAccountAddr(tx.asnd, interpreter, line);
      } else { // asset transfer
        execParams.type = types.TransactionType.TransferAsset;
        execParams.toAccountAddr =
          _getRuntimeAccountAddr(tx.arcv as Buffer, interpreter, line) ?? ZERO_ADDRESS_STR;
      }
      // set common fields (asset amount, index, closeRemTo)
      execParams.amount = tx.aamt ?? 0n;
      execParams.assetID = tx.xaid ?? 0;
      execParams.payFlags.closeRemainderTo = _getRuntimeAccountAddr(tx.aclose as Buffer, interpreter, line);
      break;
    }
    case 'acfg': { // can be asset modification, destroy, or deployment(create)
      if (isEncTxAssetDeletion(tx)) {
        execParams.type = types.TransactionType.DestroyAsset;
        execParams.assetID = tx.caid;
      } else if (isEncTxAssetConfig(tx)) {
        // from the docs: all fields must be reset, otherwise they will be cleared
        // https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/#asset-configuration
        execParams.type = types.TransactionType.ModifyAsset;
        execParams.assetID = tx.caid;
        execParams.fields = {
          manager: _getRuntimeAccountAddr(tx.apar?.m, interpreter, line) ?? "",
          reserve: _getRuntimeAccountAddr(tx.apar?.r, interpreter, line) ?? "",
          clawback: _getRuntimeAccountAddr(tx.apar?.c, interpreter, line) ?? "",
          freeze: _getRuntimeAccountAddr(tx.apar?.f, interpreter, line) ?? ""
        };
      } else { // if not delete or modify, it's ASA deployment
        execParams.type = types.TransactionType.DeployASA;
        execParams.asaName = tx.apar?.an;
        execParams.asaDef = {
          name: tx.apar?.an,
          total: tx.apar?.t,
          decimals: tx.apar?.dc !== undefined ? Number(tx.apar.dc) : undefined,
          defaultFrozen: BigInt(tx.apar?.df ?? 0n) === 1n,
          unitName: tx.apar?.un,
          url: tx.apar?.au,
          metadataHash: tx.apar?.am,
          manager: _getRuntimeAccountAddr(tx.apar?.m, interpreter, line),
          reserve: _getRuntimeAccountAddr(tx.apar?.r, interpreter, line),
          clawback: _getRuntimeAccountAddr(tx.apar?.c, interpreter, line),
          freeze: _getRuntimeAccountAddr(tx.apar?.f, interpreter, line)
        };
      }
      break;
    }
    default: {
      throw new Error(`unsupported type for itxn_submit at line ${line}, for version ${interpreter.tealVersion}`);
    }
  }

  return execParams;
}
