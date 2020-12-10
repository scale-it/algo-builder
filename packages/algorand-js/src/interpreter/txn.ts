import { Address, Transaction } from "algosdk";

import { TealError } from "../errors/errors";
import { ERRORS } from "../errors/errors-list";
import { ZERO_ADDRESS } from "../lib/constants";
import { toBytes } from "../lib/parse-data";
import { StackElem, TxnField, TxnType } from "../types";
import { Op } from "./opcode";

// regular bytes
const bytes = [
  TxnField.ApprovalProgram,
  TxnField.ClearStateProgram,
  TxnField.ConfigAssetUnitName,
  TxnField.ConfigAssetName,
  TxnField.ConfigAssetURL,
  TxnField.ConfigAssetMetadataHash
];

// 32 byte addresses
const addr = [
  TxnField.Receiver,
  TxnField.CloseRemainderTo,
  TxnField.VotePK,
  TxnField.SelectionPK,
  TxnField.AssetSender,
  TxnField.AssetReceiver,
  TxnField.AssetCloseTo,
  TxnField.ConfigAssetManager,
  TxnField.ConfigAssetReserve,
  TxnField.ConfigAssetFreeze,
  TxnField.ConfigAssetClawback,
  TxnField.FreezeAssetAccount
];

// returns default value of txn field
function defaultSpec (txField: TxnField): StackElem {
  if (bytes.includes(txField)) {
    return new Uint8Array(0);
  }
  if (addr.includes(txField)) {
    return ZERO_ADDRESS;
  }

  return BigInt('0');
}

function assertBytesDefined (a?: Uint8Array): Uint8Array {
  if (a === undefined) {
    return new Uint8Array(0);
  }
  return a;
}

function assertUint64Defined (a?: number): bigint {
  if (a === undefined) {
    return BigInt('0');
  }
  return BigInt(a);
}

// return Zero Address if addr is undefined
function assertAddr (addr?: Address): Uint8Array {
  if (addr === undefined) {
    return ZERO_ADDRESS;
  }
  return addr.publicKey;
}

/**
 * Description: returns specific transaction field value from tx object
 * @param txField: transaction field
 * @param interpreter: interpreter
 */
export function txnSpecbyField (txField: TxnField, tx: Transaction, gtxs: Transaction[]): StackElem {
  // common fields (for all transaction types)
  switch (txField) {
    case TxnField.Fee: {
      return assertUint64Defined(tx.fee);
    }
    case TxnField.FirstValid: {
      return assertUint64Defined(tx.firstRound);
    }
    case TxnField.LastValid: {
      return assertUint64Defined(tx.lastRound);
    }
    case TxnField.Sender: {
      const sender = tx.from.publicKey;
      return assertBytesDefined(sender);
    }
    case TxnField.Type: {
      return toBytes(tx.type);
    }
    case TxnField.TypeEnum: {
      const typeEnum = TxnType[tx.type as keyof typeof TxnType]; // TxnType['pay']
      return BigInt(typeEnum);
    }
    case TxnField.Lease: {
      return assertBytesDefined(tx.lease);
    }
    case TxnField.Note: {
      return assertBytesDefined(tx.note);
    }
    case TxnField.RekeyTo: {
      return assertAddr(tx.reKeyTo);
    }
    case TxnField.FirstValidTime: { // Causes program to fail; reserved for future use
      throw new TealError(ERRORS.TEAL.LOGIC_REJECTION);
    }
    case TxnField.NumAppArgs: {
      return assertUint64Defined(tx.appArgs.length);
    }
    case TxnField.NumAccounts: {
      return assertUint64Defined(tx.appAccounts.length);
    }
    case TxnField.GroupIndex: {
      const idx = gtxs.indexOf(tx);
      return assertUint64Defined(idx);
    }
    case TxnField.TxID: {
      return toBytes(tx.txID());
    }
  }

  // fields specific to txn type
  switch (tx.type) {
    // Payment Transaction
    case 'pay': {
      switch (txField) {
        case TxnField.Receiver: {
          return assertAddr(tx.to);
        }
        case TxnField.Amount: {
          return assertUint64Defined(tx.amount);
        }
        case TxnField.CloseRemainderTo: {
          return assertAddr(tx.closeRemainderTo);
        }
        default: {
          return defaultSpec(txField);
        }
      }
    }

    // Key Registration Transaction
    case 'keyreg': {
      switch (txField) {
        case TxnField.VotePK: {
          return assertBytesDefined(tx.voteKey);
        }
        case TxnField.SelectionPK: {
          return assertBytesDefined(tx.selectionKey);
        }
        case TxnField.VoteFirst: {
          return assertUint64Defined(tx.voteFirst);
        }
        case TxnField.VoteLast: {
          return assertUint64Defined(tx.voteLast);
        }
        case TxnField.VoteKeyDilution: {
          return assertUint64Defined(tx.voteKeyDilution);
        }
        default: {
          return defaultSpec(txField);
        }
      }
    }

    // Asset Configuration Transaction
    case 'acfg': {
      switch (txField) {
        case TxnField.ConfigAsset: {
          return assertUint64Defined(tx.assetIndex);
        }
        case TxnField.ConfigAssetTotal: {
          return assertUint64Defined(tx.assetTotal);
        }
        case TxnField.ConfigAssetDecimals: {
          return assertUint64Defined(tx.assetDecimals);
        }
        case TxnField.ConfigAssetDefaultFrozen: {
          return assertUint64Defined(tx.assetDefaultFrozen);
        }
        case TxnField.ConfigAssetUnitName: {
          return toBytes(tx.assetUnitName);
        }
        case TxnField.ConfigAssetName: {
          return toBytes(tx.assetName);
        }
        case TxnField.ConfigAssetURL: {
          return toBytes(tx.assetURL);
        }
        case TxnField.ConfigAssetMetadataHash: {
          return new Uint8Array(tx.assetMetadataHash);
        }
        case TxnField.ConfigAssetManager: {
          return assertAddr(tx.assetManager);
        }
        case TxnField.ConfigAssetReserve: {
          return assertAddr(tx.assetReserve);
        }
        case TxnField.ConfigAssetFreeze: {
          return assertAddr(tx.assetFreeze);
        }
        case TxnField.ConfigAssetClawback: {
          return assertAddr(tx.assetClawback);
        }
        default: {
          return defaultSpec(txField);
        }
      }
    }

    // Asset Transfer Transaction
    case 'axfer': {
      switch (txField) {
        case TxnField.XferAsset: {
          return assertUint64Defined(tx.assetIndex);
        }
        case TxnField.AssetAmount: {
          return assertUint64Defined(tx.amount);
        }
        case TxnField.AssetSender: {
          return assertAddr(tx.from);
        }
        case TxnField.AssetReceiver: {
          return assertAddr(tx.to);
        }
        case TxnField.AssetCloseTo: {
          return assertAddr(tx.closeRemainderTo);
        }
        default: {
          return defaultSpec(txField);
        }
      }
    }

    // Asset Freeze Transaction
    case 'afrz': {
      switch (txField) {
        case TxnField.FreezeAsset: {
          return assertUint64Defined(tx.assetIndex);
        }
        case TxnField.FreezeAssetAccount: {
          return assertAddr(tx.freezeAccount);
        }
        case TxnField.FreezeAssetFrozen: {
          return assertUint64Defined(tx.freezeState);
        }
        default: {
          return defaultSpec(txField);
        }
      }
    }

    // Application Call Transaction
    case 'appl': {
      switch (txField) {
        case TxnField.ApplicationID: {
          return assertUint64Defined(tx.appIndex);
        }
        case TxnField.OnCompletion: {
          return assertUint64Defined(tx.appOnComplete);
        }
        case TxnField.ApprovalProgram: {
          return assertBytesDefined(tx.appApprovalProgram);
        }
        case TxnField.ClearStateProgram: {
          return assertBytesDefined(tx.appClearProgram);
        }
        default: {
          return defaultSpec(txField);
        }
      }
    }

    default: {
      throw new TealError(ERRORS.TEAL.UNKNOWN_TRANSACTION);
    }
  }
}

/**
 * Description: returns specific transaction field value from array
 * of accounts or application args
 * @param tx: current transaction
 * @param txField: transaction field
 * @param idx: index
 */
export function txnaSpecbyField (txField: TxnField, tx: Transaction, idx: number, op: Op): Uint8Array {
  switch (txField) {
    case TxnField.Accounts: {
      op.checkIndexBound(idx, tx.appAccounts);
      const acc = tx.appAccounts[idx];
      return acc.publicKey;
    }
    case TxnField.ApplicationArgs: {
      op.checkIndexBound(idx, tx.appArgs);
      return tx.appArgs[idx];
    }
    default: {
      throw new TealError(ERRORS.TEAL.INVALID_OP_ARG, {
        opcode: "txna/gtxna"
      });
    }
  }
}
