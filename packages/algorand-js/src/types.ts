import { AccountInfo } from "algosdk";

import {
  Add, Addr, Arg, Byte, Bytec, Bytecblock, Div, Int, Len, Mul, Sub
} from "./interpreter/opcode-list";
import type { IStack } from "./lib/stack";

export type Operator = Len | Add | Sub |
Mul | Div | Arg | Bytecblock | Bytec | Addr | Int | Byte;

export type AppArgs = Array<string | number>;

export type StackElem = bigint | Uint8Array;
export type TEALStack = IStack<bigint | Uint8Array>;

// https://developer.algorand.org/docs/reference/teal/opcodes/#txn
export enum TxnField {
  Sender, // 32 byte address
  Fee, // micro-Algos
  FirstValid, // round number
  FirstValidTime,
  LastValid, // round number
  Note,
  Lease,
  Receiver, // 32 byte address
  Amount, // micro-Algos
  CloseRemainderTo, // 32 byte address
  VotePK, // 32 byte address
  SelectionPK, // 32 byte address
  VoteFirst,
  VoteLast,
  VoteKeyDilution,
  Type,
  TypeEnum,
  XferAsset, // Asset ID
  AssetAmount, // value in Asset's units
  AssetSender, // 32 byte address. Causes clawback of all value of asset from AssetSender if Sender is the Clawback address of the asset.
  AssetReceiver, // 32 byte address
  AssetCloseTo, // 32 byte address
  GroupIndex, // Position of this transaction within an atomic transaction group. A stand-alone transaction is implicitly element 0 in a group of 1
  TxID, // The computed ID for this transaction. 32 bytes.
  ApplicationID, // ApplicationID from ApplicationCall transaction.
  OnCompletion, // ApplicationCall transaction on completion action.
  ApplicationArgs, // Arguments passed to the application in the ApplicationCall transaction.
  NumAppArgs, // Number of ApplicationArgs.
  Accounts, // Accounts listed in the ApplicationCall transaction.
  NumAccounts, // Number of Accounts
  ApprovalProgram, // Approval program
  ClearStateProgram, // Clear state program
  RekeyTo, // 32 byte Sender's new AuthAddr
  ConfigAsset, // Asset ID in asset config transaction
  ConfigAssetTotal, // Total number of units of this asset created
  ConfigAssetDecimals, // Number of digits to display after the decimal place when displaying the asset
  ConfigAssetDefaultFrozen, // Whether the asset's slots are frozen by default or not, 0 or 1
  ConfigAssetUnitName, // Unit name of the asset
  ConfigAssetName, // The asset name
  ConfigAssetURL, // URL
  ConfigAssetMetadataHash, // 32 byte commitment to some unspecified asset metadata
  ConfigAssetManager, // 32 byte address
  ConfigAssetReserve, // 32 byte address
  ConfigAssetFreeze, // 32 byte address
  ConfigAssetClawback, // 32 byte address
  FreezeAsset, // Asset ID being frozen or un-frozen
  FreezeAssetAccount, // 32 byte address of the account whose asset slot is being frozen or un-frozen.
  FreezeAssetFrozen // The new frozen value, 0 or 1
}

export enum TxnType {
  unknown, // Unknown type. Invalid transaction
  pay, // Payment
  keyreg, // KeyRegistration
  acfg, // AssetConfig
  axfer, // AssetTransfer
  afrz, // AssetFreeze
  appl // ApplicationCall
}

// https://developer.algorand.org/docs/reference/teal/specification/#oncomplete
export enum TxnOnComplete {
  NoOp,
  OptIn,
  CloseOut,
  ClearState,
  UpdateApplication,
  DeleteApplication
}

export enum GlobalField {
  MinTxnFee, // micro Algos
  MinBalance, // micro Algos
  MaxTxnLife, // rounds
  ZeroAddress, // 32 byte address of all zero bytes
  GroupSize, // Number of transactions in this atomic transaction group. At least 1
  LogicSigVersion, // Maximum supported TEAL version.
  Round, // Current round number
  LatestTimestamp, // Last confirmed block UNIX timestamp. Fails if negative.
  CurrentApplicationID // ID of current application executing. Fails if no such application is executing.
}

// will be mapped to a specific account
export enum AssetHolding {
  AssetBalance, // Amount of the asset unit held by this account
  AssetFrozen // Is the asset frozen or not
}

// this is for global storage
export enum AssetParam {
  AssetTotal, // Total number of units of this asset
  AssetDecimals, // See AssetParams.Decimals
  AssetDefaultFrozen, // Frozen by default or not
  AssetUnitName, // Asset unit name
  AssetName, // Asset name
  AssetURL, // URL with additional info about the asset
  AssetMetadataHash, // Arbitrary commitment
  AssetManager, // Manager commitment
  AssetReserve, // Reserve address
  AssetFreeze, // Freeze address
  AssetClawback // Clawback address
}

export enum EncodingType {
  BASE64,
  BASE32,
  HEX
}

export interface AccountsMap {
  [addr: string]: AccountInfo
}
