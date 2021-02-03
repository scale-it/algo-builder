import {
  Account,
  AssetDef,
  AssetHolding,
  LogicSig,
  SSCSchemaConfig,
  TxnEncodedObj
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

export type TxField = keyof typeof TxnFields[2];

export enum TxnType {
  unknown = '0', // Unknown type. Invalid transaction
  pay = '1', // Payment
  keyreg = '2', // KeyRegistration
  acfg = '3', // AssetConfig
  axfer = '4', // AssetTransfer
  afrz = '5', // AssetFreeze
  appl = '6' // ApplicationCall
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

export enum EncodingType {
  BASE64,
  BASE32,
  HEX,
  UTF8
}

export type AccountAddress = string;

export interface AccountsMap {
  [addr: string]: StoreAccountI
}

export interface State {
  accounts: Map<string, StoreAccountI>
  globalApps: Map<number, GlobalAppsData>
  assetDefs: Map<number, AccountAddress>
}

// describes interpreter's local context (state + txns)
export interface Context {
  state: State
  tx: Txn // current txn
  gtxs: Txn[] // all transactions
  args: Uint8Array[]
}

// custom AppsLocalState for StoreAccount (using maps instead of array in 'key-value')
export interface AppLocalStateM {
  id: number
  'key-value': Map<string, StackElem> // string represents bytes as string eg. 11,22,34
  schema: SSCSchemaConfig
}

// custom SSCAttributes for StoreAccount (using maps instead of array in 'global-state')
export interface SSCAttributesM {
  'approval-program': string
  'clear-state-program': string
  creator: string
  'global-state': Map<string, StackElem>
  'global-state-schema': SSCSchemaConfig
  'local-state-schema': SSCSchemaConfig
}

// custom CreatedApp for StoreAccount
export interface CreatedAppM {
  id: number
  attributes: SSCAttributesM
}

export interface GlobalAppsData {
  address: AccountAddress
  approvalProgram: string
  clearProgram: string
}

// represent account used in tests and by the context
// NOTE: custom notations are used rather than SDK AccountState notations
export interface StoreAccountI {
  address: string
  assets: Map<number, AssetHolding>
  amount: number
  minBalance: number
  appsLocalState: Map<number, AppLocalStateM>
  appsTotalSchema: SSCSchemaConfig
  createdApps: Map<number, SSCAttributesM>
  createdAssets: Map<number, AssetDef>
  account: Account

  balance: () => number
  getApp: (appId: number) => SSCAttributesM | undefined
  getAppFromLocal: (appId: number) => AppLocalStateM | undefined
  addApp: (appId: number, params: SSCDeploymentFlags) => CreatedAppM
  optInToApp: (appId: number, appParams: SSCAttributesM) => void
  deleteApp: (appId: number) => void
  closeApp: (appId: number) => void
  getLocalState: (appId: number, key: Uint8Array | string) => StackElem | undefined
  setLocalState: (appId: number, key: Uint8Array | string, value: StackElem, line?: number) => AppLocalStateM
  getGlobalState: (appId: number, key: Uint8Array | string) => StackElem | undefined
  setGlobalState: (appId: number, key: Uint8Array | string, value: StackElem, line?: number) => void
}

// https://developer.algorand.org/docs/reference/teal/specification/#oncomplete
export enum TxnOnComplete {
  NoOp = '0',
  OptIn = '1',
  CloseOut = '2',
  ClearState = '3',
  UpdateApplication = '4',
  DeleteApplication = '5'
}

// https://developer.algorand.org/docs/reference/teal/specification/#execution-modes
export enum ExecutionMode {
  STATELESS, // stateless TEAL
  STATEFUL // application call (NoOp, CloseOut..)
}

export interface TxParams {
  /**
   * feePerByte or totalFee is used to set the appropriate transaction fee parameter.
   * If both are set then totalFee takes precedence.
   * NOTE: SDK expects`fee: number` and boolean `flatFee`. But the API expects only one
   * on parameter: `fee`. Here, we define feePerByte and totalFee - both as numberic
   * parameters. We think that this is more explicit. */
  feePerByte?: number
  totalFee?: number
  firstValid?: number
  validRounds?: number
  lease?: Uint8Array
  note?: string
  noteb64?: string
  closeRemainderTo?: AccountAddress
}

/**
 * Stateful Smart contract flags for specifying sender and schema */
export interface SSCDeploymentFlags extends SSCOptionalFlags {
  sender: Account
  localInts: number
  localBytes: number
  globalInts: number
  globalBytes: number
}

/**
 * Stateful smart contract transaction optional parameters (accounts, args..). */
export interface SSCOptionalFlags {
  appArgs?: Array<Uint8Array | string>
  accounts?: string[]
  foreignApps?: number[]
  foreignAssets?: number[]
  note?: Uint8Array
  lease?: Uint8Array
  rekeyTo?: string
}

export type ExecParams = AlgoTransferParam | AssetTransferParam | SSCCallsParam;

export enum SignType {
  SecretKey,
  LogicSignature
}

export enum TransactionType {
  TransferAlgo,
  TransferAsset,
  CallNoOpSSC,
  ClearSSC,
  CloseSSC,
  DeleteSSC
}

export interface Sign {
  sign: SignType
  lsig?: LogicSig
}

export interface AlgoTransferParam extends Sign {
  type: TransactionType.TransferAlgo
  fromAccount: Account
  toAccountAddr: AccountAddress
  amountMicroAlgos: number
  payFlags: TxParams
}

export interface AssetTransferParam extends Sign {
  type: TransactionType.TransferAsset
  fromAccount: Account
  toAccountAddr: AccountAddress
  amount: number
  assetID: number
  payFlags: TxParams
}

export interface SSCCallsParam extends SSCOptionalFlags, Sign {
  type: TransactionType.CallNoOpSSC | TransactionType.ClearSSC |
  TransactionType.CloseSSC | TransactionType.DeleteSSC
  fromAccount: Account
  appId: number
  payFlags: TxParams
}

export interface AnyMap {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}
