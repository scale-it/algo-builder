import {
  Account as AccountSDK,
  AssetDef,
  LogicSig,
  LogicSigArgs,
  SSCSchemaConfig,
  TxnEncodedObj
} from "algosdk";
import * as z from 'zod';

import {
  Add, Addr, Arg, Byte, Bytec,
  Bytecblock, Div, Int, Len, Mul,
  Pragma, Sub
} from "./interpreter/opcode-list";
import { TxnFields } from "./lib/constants";
import type { IStack } from "./lib/stack";
import type { ASADefSchema, ASADefsSchema } from "./types-input";

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
  [addr: string]: AccountStoreI
}

/**
 * RuntimeAccountMap is for AccountStore used in runtime
 * (where we use maps instead of arrays in sdk structures). */
export type RuntimeAccountMap = Map<string, AccountStoreI>;

export interface State {
  accounts: Map<string, AccountStoreI>
  globalApps: Map<number, string>
  assetDefs: Map<number, AccountAddress>
  assetNameInfo: Map<string, ASAInfo>
  appNameInfo: Map<string, SSCInfo>
  appCounter: number
  assetCounter: number
}

export interface DeployedAssetInfo {
  creator: AccountAddress
  txId: string
  confirmedRound: number
}

// ASA deployment information (log)
export interface ASAInfo extends DeployedAssetInfo {
  assetIndex: number
  assetDef: ASADef
}

// Stateful smart contract deployment information (log)
export interface SSCInfo extends DeployedAssetInfo {
  appID: number
  timestamp: number
}

// describes interpreter's local context (state + txns)
export interface Context {
  state: State
  tx: Txn // current txn
  gtxs: Txn[] // all transactions
  args: Uint8Array[]
  getAccount: (address: string) => AccountStoreI
  getAssetAccount: (assetId: number) => AccountStoreI
  getApp: (appId: number, line?: number) => SSCAttributesM
  transferAlgo: (txnParam: AlgoTransferParam) => void
  deductFee: (sender: AccountAddress, index: number) => void
  transferAsset: (txnParam: AssetTransferParam) => void
  modifyAsset: (assetId: number, fields: AssetModFields) => void
  freezeAsset: (assetId: number, freezeTarget: string, freezeState: boolean) => void
  revokeAsset: (
    recipient: string, assetID: number,
    revocationTarget: string, amount: bigint
  ) => void
  destroyAsset: (assetId: number) => void
  deleteApp: (appId: number) => void
  closeApp: (sender: AccountAddress, appId: number) => void
  processTransactions: (txnParams: ExecParams[]) => void
  addAsset: (name: string, fromAccountAddr: AccountAddress, flags: ASADeploymentFlags) => number
  optIntoASA: (assetIndex: number, address: AccountAddress, flags: TxParams) => void
  addApp: (
    fromAccountAddr: string, flags: SSCDeploymentFlags,
    approvalProgram: string, clearProgram: string
  ) => number
  optInToApp: (accountAddr: string, appID: number) => void
  updateApp: (appID: number, approvalProgram: string, clearProgram: string) => void
}

// custom AssetHolding for AccountStore (using bigint in amount instead of number)
export interface AssetHoldingM {
  amount: bigint
  'asset-id': number
  creator: string
  'is-frozen': boolean
}

// custom AppsLocalState for AccountStore (using maps instead of array in 'key-value')
export interface AppLocalStateM {
  id: number
  'key-value': Map<string, StackElem> // string represents bytes as string eg. 11,22,34
  schema: SSCSchemaConfig
}

// custom SSCAttributes for AccountStore (using maps instead of array in 'global-state')
export interface SSCAttributesM {
  'approval-program': string
  'clear-state-program': string
  creator: string
  'global-state': Map<string, StackElem>
  'global-state-schema': SSCSchemaConfig
  'local-state-schema': SSCSchemaConfig
}

// custom CreatedApp for AccountStore
export interface CreatedAppM {
  id: number
  attributes: SSCAttributesM
}

// represent account used in tests and by the context
// NOTE: custom notations are used rather than SDK AccountState notations
export interface AccountStoreI {
  address: string
  assets: Map<number, AssetHoldingM>
  amount: bigint
  minBalance: number
  appsLocalState: Map<number, AppLocalStateM>
  appsTotalSchema: SSCSchemaConfig
  createdApps: Map<number, SSCAttributesM>
  createdAssets: Map<number, AssetDef>
  account: AccountSDK

  balance: () => bigint
  getApp: (appId: number) => SSCAttributesM | undefined
  getAppFromLocal: (appId: number) => AppLocalStateM | undefined
  addApp: (appId: number, params: SSCDeploymentFlags,
    approvalProgram: string, clearProgram: string) => CreatedAppM
  getAssetDef: (assetId: number) => AssetDef | undefined
  getAssetHolding: (assetId: number) => AssetHoldingM | undefined
  addAsset: (assetId: number, name: string, asadef: ASADef) => AssetDef
  modifyAsset: (assetId: number, fields: AssetModFields) => void
  setFreezeState: (assetId: number, state: boolean) => void
  destroyAsset: (assetId: number) => void
  optInToApp: (appId: number, appParams: SSCAttributesM) => void
  optInToASA: (assetIndex: number, assetHolding: AssetHoldingM) => void
  deleteApp: (appId: number) => void
  closeApp: (appId: number) => void
  getLocalState: (appId: number, key: Uint8Array | string) => StackElem | undefined
  setLocalState: (appId: number, key: Uint8Array | string, value: StackElem, line?: number) => AppLocalStateM
  getGlobalState: (appId: number, key: Uint8Array | string) => StackElem | undefined
  setGlobalState: (appId: number, key: Uint8Array | string, value: StackElem, line?: number) => void
}

/**
 * https://developer.algorand.org/docs/reference/teal/specification/#oncomplete */
export enum TxnOnComplete {
  NoOp = '0',
  OptIn = '1',
  CloseOut = '2',
  ClearState = '3',
  UpdateApplication = '4',
  DeleteApplication = '5'
}

/**
 * https://developer.algorand.org/docs/reference/teal/specification/#execution-modes */
export enum ExecutionMode {
  STATELESS, // stateless TEAL
  STATEFUL // application call (NoOp, CloseOut..)
}

/**
 * Common transaction parameters (fees, note..) */
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
  rekeyTo?: AccountAddress
}

/**
 * Stateful Smart contract flags for specifying sender and schema */
export interface SSCDeploymentFlags extends SSCOptionalFlags {
  sender: AccountSDK
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
}

/**
 * Transaction execution parameters (on blockchain OR runtime) */
export type ExecParams = AlgoTransferParam | AssetTransferParam | SSCCallsParam |
ModifyAssetParam | FreezeAssetParam | RevokeAssetParam |
DestroyAssetParam | DeployASAParam | DeploySSCParam |
OptInSSCParam | OptInASAParam | UpdateSSCParam;

export enum SignType {
  SecretKey,
  LogicSignature
}

export enum TransactionType {
  TransferAlgo,
  TransferAsset,
  ModifyAsset,
  FreezeAsset,
  RevokeAsset,
  DestroyAsset,
  CallNoOpSSC,
  ClearSSC,
  CloseSSC,
  DeleteSSC,
  DeployASA,
  DeploySSC,
  OptInASA,
  OptInSSC,
  UpdateSSC
}

interface SignWithSk {
  sign: SignType.SecretKey
  fromAccount: AccountSDK
  /**
   * if passed then it will be used as the from account address, but tx will be signed
   * by fromAcount's sk. This is used if an account address is rekeyed to another account. */
  fromAccountAddr?: AccountAddress
}

interface SignWithLsig {
  sign: SignType.LogicSignature
  fromAccountAddr: AccountAddress
  lsig: LogicSig
  /** stateless smart contract args */
  args?: LogicSigArgs
}

export type Sign = SignWithSk | SignWithLsig;

export type BasicParams = Sign & {
  payFlags: TxParams
};

export type DeployASAParam = BasicParams & {
  type: TransactionType.DeployASA
  asaName: string
  asaDef?: Partial<ASADef>
};

export type DeploySSCParam = BasicParams & SSCOptionalFlags & {
  type: TransactionType.DeploySSC
  approvalProgram: string
  clearProgram: string
  localInts: number
  localBytes: number
  globalInts: number
  globalBytes: number
  approvalProg?: Uint8Array
  clearProg?: Uint8Array
};

export type UpdateSSCParam = BasicParams & SSCOptionalFlags & {
  type: TransactionType.UpdateSSC
  appID: number
  newApprovalProgram: string
  newClearProgram: string
  approvalProg?: Uint8Array
  clearProg?: Uint8Array
};

export type OptInSSCParam = BasicParams & SSCOptionalFlags & {
  type: TransactionType.OptInSSC
  appID: number
};

export type OptInASAParam = BasicParams & {
  type: TransactionType.OptInASA
  assetID: number | string
};

export type ModifyAssetParam = BasicParams & {
  type: TransactionType.ModifyAsset
  assetID: number | string
  fields: AssetModFields
};

export type FreezeAssetParam = BasicParams & {
  type: TransactionType.FreezeAsset
  assetID: number | string
  freezeTarget: AccountAddress
  freezeState: boolean
};

export type RevokeAssetParam = BasicParams & {
  type: TransactionType.RevokeAsset
  /**
   * Revoked assets are sent to this address
   */
  recipient: AccountAddress
  assetID: number | string
  /** Revocation target is the account from which the clawback revokes asset. */
  revocationTarget: AccountAddress
  amount: number | bigint
};

export type DestroyAssetParam = BasicParams & {
  type: TransactionType.DestroyAsset
  assetID: number | string
};

export type AlgoTransferParam = BasicParams & {
  type: TransactionType.TransferAlgo
  toAccountAddr: AccountAddress
  amountMicroAlgos: number | bigint
};

export type AssetTransferParam = BasicParams & {
  type: TransactionType.TransferAsset
  toAccountAddr: AccountAddress
  amount: number | bigint
  assetID: number | string
};

export type SSCCallsParam = BasicParams & SSCOptionalFlags & {
  type: TransactionType.CallNoOpSSC | TransactionType.ClearSSC |
  TransactionType.CloseSSC | TransactionType.DeleteSSC
  appId: number
};

export interface AnyMap {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface Account extends AccountSDK {
  // from AccountSDK: addr: string;
  //                  sk: Uint8Array
  name: string
}

export interface ASADeploymentFlags extends TxParams {
  creator: Account
}

/**
 * SDK account type, used in algob */
export type AccountMap = Map<string, Account>;

export type ASADef = z.infer<typeof ASADefSchema>;

export type ASADefs = z.infer<typeof ASADefsSchema>;

/**
 * After an asset has been created only the manager,
 * reserve, freeze and reserve accounts can be changed.
 * All other parameters are locked for the life of the asset.
 */
export interface AssetModFields {
  manager?: string
  reserve?: string
  freeze?: string
  clawback?: string
}
