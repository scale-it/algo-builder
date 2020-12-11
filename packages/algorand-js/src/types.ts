import { AccountInfo } from "algosdk";
import { Interface } from "readline";

import {
  Add, Arg, Bytec, Bytecblock, Div, Len, Mul, Sub
} from "./interpreter/opcode-list";
import type { IStack } from "./lib/stack";

export type Operator = Len | Add | Sub |
Mul | Div | Arg | Bytecblock | Bytec;

export type AppArgs = Array<string | number>;

export type StackElem = bigint | Uint8Array;
export type TEALStack = IStack<bigint | Uint8Array>;

export interface TxnEncodedObj {
  // common fields
  // https://developer.algorand.org/docs/reference/transactions/#common-fields-header-and-type
  fee: number
  fv: number
  lv: number
  note: Buffer
  snd: Buffer
  type: string
  gen: string
  gh: Buffer
  rekey: Buffer
  lx: Buffer
  grp: Buffer

  // Payment Transaction
  // https://developer.algorand.org/docs/reference/transactions/#payment-transaction
  rcv: Buffer,
  amt: number,
  close: Buffer

  // Key Registration Transaction
  // https://developer.algorand.org/docs/reference/transactions/#key-registration-transaction
  votekey: Buffer
  selkey: Buffer
  votefst: number
  votelst: number
  votekd: number

  // Asset Configuration Transaction
  // https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction
  caid: number
  apar: AssetParamsEnc

  // Asset Transfer Transaction
  // https://developer.algorand.org/docs/reference/transactions/#asset-transfer-transaction
  xaid: number
  aamt: number
  asnd: Buffer
  arcv: Buffer
  aclose: Buffer

  // Asset Freeze Transaction
  // https://developer.algorand.org/docs/reference/transactions/#asset-freeze-transaction
  fadd: Buffer
  faid: number
  afrz: boolean

  // Application Call Transaction
  // https://developer.algorand.org/docs/reference/transactions/#application-call-transaction
  apid: number
  apan: TxnOnComplete
  apat: Buffer[]
  apap: Buffer
  apaa: Buffer[]
  apsu: Buffer
  apfa: number[]
  apas: number[]
  apls: StateSchemaEnc
  apgs: StateSchemaEnc

  txID: string
}

// https://developer.algorand.org/docs/reference/transactions/#asset-parameters
export interface AssetParamsEnc {
  t: number
  dc: number
  df: number
  un: string
  an: string
  au: string
  am: Buffer
  m: Buffer
  r: Buffer
  f: Buffer
  c: Buffer
}

// https://developer.algorand.org/docs/reference/transactions/#storage-state-schema
export interface StateSchemaEnc {
  nui: number
  nbs: number
}

// https://developer.algorand.org/docs/reference/teal/opcodes/#txn
export const TxnFields: {[key: string]: any} = {
  Sender: 'snd',
  Fee: 'fee',
  FirstValid: 'fv',
  FirstValidTime: '',
  LastValid: 'lv',
  Note: 'note',
  Lease: 'lx',
  Receiver: 'rcv',
  Amount: 'amt',
  CloseRemainderTo: 'close',
  VotePK: 'votekey',
  SelectionPK: 'selkey',
  VoteFirst: 'votefst',
  VoteLast: 'votelst',
  VoteKeyDilution: 'votekd',
  Type: 'type',
  TypeEnum: '',
  XferAsset: 'xaid',
  AssetAmount: 'aamt',
  AssetSender: 'asnd',
  AssetReceiver: 'arcv',
  AssetCloseTo: 'aclose',
  GroupIndex: '',
  TxID: '',
  ApplicationID: 'apid',
  OnCompletion: 'apan',
  ApplicationArgs: 'apaa',
  NumAppArgs: '',
  Accounts: 'apat',
  NumAccounts: '',
  ApprovalProgram: 'apap',
  ClearStateProgram: 'apsu',
  RekeyTo: 'rekey',
  ConfigAsset: 'caid',
  ConfigAssetTotal: 't',
  ConfigAssetDecimals: 'dc',
  ConfigAssetDefaultFrozen: 'df',
  ConfigAssetUnitName: 'un',
  ConfigAssetName: 'an',
  ConfigAssetURL: 'au',
  ConfigAssetMetadataHash: 'am',
  ConfigAssetManager: 'm',
  ConfigAssetReserve: 'r',
  ConfigAssetFreeze: 'f',
  ConfigAssetClawback: 'c',
  FreezeAsset: 'faid',
  FreezeAssetAccount: 'fadd',
  FreezeAssetFrozen: 'afrz',
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