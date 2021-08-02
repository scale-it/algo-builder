import { Account as AccountSDK, LogicSig } from 'algosdk';
import * as z from 'zod';

import type { ASADefSchema, ASADefsSchema } from "./types-input";

export type AccountAddress = string;

export interface AnyMap {
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

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
  flatFee?: boolean
  // The first round for when the transaction is valid.
  firstValid?: number
  // firstValid + validRounds will give us the ending round for which the transaction is valid.
  validRounds?: number
  // A lease enforces mutual exclusion of transactions.
  lease?: Uint8Array
  // Any data up to 1000 bytes.
  note?: string
  noteb64?: string
  // When set, it indicates that the transaction is requesting
  // that the Sender account should be closed, and all remaining
  // funds, after the fee and amount are paid, be transferred to this address.
  closeRemainderTo?: AccountAddress
  // Specifies the authorized address.
  rekeyTo?: AccountAddress
  // you can learn more about these parameters here.(https://developer.algorand.org/docs/reference/transactions/#common-fields-header-and-type)
}

/**
 * Stateful Smart contract flags for specifying sender and schema */
export interface AppDeploymentFlags extends AppOptionalFlags {
  sender: AccountSDK
  localInts: number
  localBytes: number
  globalInts: number
  globalBytes: number
}

/**
 * Stateful smart contract transaction optional parameters (accounts, args..). */
export interface AppOptionalFlags {
  /**
   * Transaction specific arguments accessed from
   * the application's approval-program and clear-state-program.
   */
  appArgs?: Array<Uint8Array | string>
  /**
   * List of accounts in addition to the sender that may
   * be accessed from the application's approval-program and clear-state-program.
   */
  accounts?: string[]
  /**
   * Lists the applications in addition to the application-id
   * whose global states may be accessed by this
   * application's approval-program and clear-state-program. The access is read-only.
   */
  foreignApps?: number[]
  /**
   * Lists the assets whose AssetParams may be accessed by
   * this application's approval-program and clear-state-program.
   * The access is read-only.
   */
  foreignAssets?: number[]
  // Any data up to 1000 bytes.
  note?: Uint8Array
  // A lease enforces mutual exclusion of transactions.
  lease?: Uint8Array
  // you can learn more about these parameters from here.(https://developer.algorand.org/docs/reference/transactions/#application-call-transaction)
}

/**
 * Transaction execution parameters (on blockchain OR runtime) */
export type ExecParams = AlgoTransferParam | AssetTransferParam | AppCallsParam |
ModifyAssetParam | FreezeAssetParam | RevokeAssetParam |
DestroyAssetParam | DeployASAParam | DeployAppParam |
OptInASAParam | UpdateAppParam;

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
  ClearApp,
  CloseApp,
  DeleteApp,
  DeployASA,
  DeployApp,
  OptInASA,
  OptInToApp,
  UpdateApp
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
  fromAccount?: AccountSDK
  fromAccountAddr: AccountAddress
  lsig: LogicSig
  /** stateless smart contract args */
  args?: Uint8Array[]
}

export type Sign = SignWithSk | SignWithLsig;

export type BasicParams = Sign & {
  payFlags: TxParams
};

export type DeployASAParam = BasicParams & {
  type: TransactionType.DeployASA
  asaName: string
  asaDef?: ASADef
  overrideAsaDef?: Partial<ASADef>
};

export type DeployAppParam = BasicParams & AppOptionalFlags & {
  type: TransactionType.DeployApp
  approvalProgram: string
  clearProgram: string
  localInts: number
  localBytes: number
  globalInts: number
  globalBytes: number
  approvalProg?: Uint8Array
  clearProg?: Uint8Array
};

export type UpdateAppParam = BasicParams & AppOptionalFlags & {
  type: TransactionType.UpdateApp
  appID: number
  newApprovalProgram: string
  newClearProgram: string
  approvalProg?: Uint8Array
  clearProg?: Uint8Array
};

export type AppCallsParam = BasicParams & AppOptionalFlags & {
  type: TransactionType.CallNoOpSSC | TransactionType.ClearApp |
  TransactionType.CloseApp | TransactionType.DeleteApp | TransactionType.OptInToApp
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

export type ASADef = z.infer<typeof ASADefSchema>;

export type ASADefs = z.infer<typeof ASADefsSchema>;

export interface RequestError extends Error {
  response?: {
    statusCode: number
    text: string
    body: {
      message: string
    }
    error?: Error
  }
  error?: Error
}
