import {
  Account,
  AccountAssetInfo, AppLocalState, CreatedApps, CreatedAssets, SSCParams, SSCSchemaConfig, TxnEncodedObj
} from "algosdk";

import {
  Add, Addr, Arg, Byte, Bytec, Bytecblock, Div, Int, Len, Mul, Pragma,
  Sub
} from "./interpreter/opcode-list";
import { TxnFields } from "./lib/constants";
import type { IStack } from "./lib/stack";

export type Operator = Len | Add | Sub |
Mul | Div | Arg | Bytecblock | Bytec | Addr | Int | Byte | Pragma;

export type AppArgs = Array<string | number>;

export type StackElem = bigint | Uint8Array;
export type TEALStack = IStack<bigint | Uint8Array>;

export interface Txn extends TxnEncodedObj {
  txID: string
}

export type TxField = keyof typeof TxnFields;

export enum TxnType {
  unknown, // Unknown type. Invalid transaction
  pay, // Payment
  keyreg, // KeyRegistration
  acfg, // AssetConfig
  axfer, // AssetTransfer
  afrz, // AssetFreeze
  appl // ApplicationCall
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
  HEX,
  UTF8
}

export interface AccountsMap {
  [addr: string]: StoreAccount
}

export interface State {
  accounts: Map<string, StoreAccount>
  globalApps: Map<number, SSCParams>
}

// describes interpreter's local context (state + txns)
export interface Context {
  state: State
  tx: Txn // current txn
  gtxs: Txn[] // all transactions
  args: Uint8Array[]
}

// represent account used in tests and by the context
// NOTE: custom notations are used rather than SDK AccountState notations
export interface StoreAccount {
  address: string
  assets: AccountAssetInfo[]
  amount: number
  appsLocalState: AppLocalState[]
  appsTotalSchema: SSCSchemaConfig
  createdApps: CreatedApps[]
  createdAssets: CreatedAssets[]
  account?: Account

  balance: () => number
  getLocalState: (appId: number, key: Uint8Array) => StackElem | undefined
  updateLocalState: (appId: number, key: Uint8Array, value: StackElem) => AppLocalState[]
}
