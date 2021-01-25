// Type definitions for algosdk 1.8.0
// Project: https://github.com/algorand/js-algorand-sdk
// Definitions by: Robert Zaremba <https://github.com/robert-zaremba>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare module 'algosdk' {

  export class Algod {
    constructor(token: string, baseServer: string, port: number, headers?: object);

    status(): Promise<NodeStatus>;
  }

  export class Algodv2 {
    // https://github.com/algorand/js-algorand-sdk/blob/develop/src/client/v2/algod/algod.js#L19
    constructor(token: string, baseServer: string, port: number, headers?: object);

    compile(source: string): Action<CompileOut>;
    status(): Action<any>;

    sendRawTransaction(rawSignedTxn: TxnBytes | TxnBytes[]): Action<TxResult>;
    getTransactionParams(): Action<SuggestedParams>;
    pendingTransactionInformation(txId: string): Action<ConfirmedTxInfo>;
    statusAfterBlock(lastround: number): Action<any>;
    accountInformation(address: string): Action<AccountState>;
  }

  export const OnApplicationComplete: {
    ClearStateOC: number;
    CloseOutOC: number;
    DeleteApplicationOC: number;
    NoOpOC: number;
    OptInOC: number;
    UpdateApplicationOC: number;
  };

  export namespace modelsv2 {
    function Account(...args: any[]): void;

    function Application(...args: any[]): void;

    function ApplicationLocalState(...args: any[]): void;

    function ApplicationParams(...args: any[]): void;

    function ApplicationStateSchema(...args: any[]): void;

    function Asset(...args: any[]): void;

    function AssetHolding(...args: any[]): void;

    function AssetDef(...args: any[]): void;

    function DryrunRequest(...args: any[]): void;

    function DryrunSource(...args: any[]): void;

    function TealKeyValue(...args: any[]): void;

    function TealValue(...args: any[]): void;
  }

  export class Kmd {
    constructor(token: string, baseServer: string, port: number);

    versions(): Promise<any>;
    listWallets(): Promise<Wallets>;
    initWalletHandle(walletid: string, password: string): Promise<WalletHandle>;
    listKeys(wallet_handle_token: string): Promise<Keys>;
    exportKey(wallet_handle_token: string, password: string, address: string): Promise<PrivKeyWrapper>;
  }

  export interface Wallets {
    wallets: WalletDetails[];
  }

  export interface WalletDetails {
    driver_name: string;
    driver_version: number;
    id: string;
    mnemonic_ux: boolean;
    name: string;
    supported_txs: string[];
  }

  export interface PrivKeyWrapper {
    private_key: Uint8Array;
  }

  export interface Keys {
    addresses: string[];
  }

  export interface WalletHandle {
    wallet_handle_token: string;
  }

  export interface Account {
    addr: string;
    sk: Uint8Array;
  }

  export interface CompileOut {
    hash: string;
    result: string;
  }

  // https://github.com/algorand/js-algorand-sdk/blob/develop/src/transaction.js
  export interface Transaction {
    // fields copied from
    // https://github.com/algorand/js-algorand-sdk/blob/develop/src/transaction.js#L117
    from: Address;
    to: Address;
    fee: number;
    amount: number;
    firstRound: number;
    lastRound: number;
    note: Uint8Array;
    genesisID: string;
    genesisHash: Buffer;
    lease: Uint8Array;

    closeRemainderTo: Address;
    voteKey: Buffer;
    selectionKey: Buffer;
    voteFirst: any;
    voteLast: any;
    voteKeyDilution: any;

    assetIndex: number;
    assetTotal: number;
    assetDecimals: number;
    assetDefaultFrozen: any;
    assetManager: Address;
    assetReserve: Address;

    assetFreeze: Address;
    assetClawback: Address;
    assetUnitName: string;
    assetName: string;
    assetURL: string;
    assetMetadataHash: Buffer;

    freezeAccount: Address;
    freezeState: any;
    assetRevocationTarget: any;

    appIndex: number;
    appOnComplete: number;
    appLocalInts: number;
    appLocalByteSlices: number;
    appGlobalInts: number;
    appGlobalByteSlices: number;

    appApprovalProgram: Uint8Array;
    appClearProgram: Uint8Array;
    appArgs: Uint8Array[];
    appAccounts: Address[];
    appForeignApps: number[];
    appForeignAssets: number[];
    type: string;
    reKeyTo: Address;
    group: Buffer;

    addLease: (lease: Uint8Array | undefined, feePerByte?: number) => void;
    addRekey: (reKeyTo: string, feePerByte?: number) => void;
    bytesToSign: () => Uint8Array;
    signTxn: (sk: Uint8Array) => TxnBytes;
    toByte: () => Uint8Array;
    txID: () => string;

    from_obj_for_encoding: (txnForEnc: unknown) => Transaction;
    get_obj_for_encoding: () => unknown;
  }

  // an object created by `Transaction.signTxn` before serializing
  export interface SignedTransaction {
    txn: Transaction;
    sig: Uint8Array;
  }

  // args Program arguments as array of Uint8Array arrays
  export type LogicSigArgs = Uint8Array[];

  export interface Subsig {
    pk: Uint8Array;
    s: Uint8Array;
  }

  export interface MultiSig {
    subsig: Subsig[];
    thr: number;
    v: number;
  }

  export interface MultiSigAccount {
    version: number;
    threshold: number;
    // array of base32 encoded addresses
    addrs: string[];
  }

  // Stateful Smart Contract Schema
  export interface SSCStateSchema {
    key: Uint8Array;
    value: {
      type: number;
      bytes: Uint8Array;
      uint: number;
    };
  }

  // total byte slices and uint for account or unique appId
  export interface SSCSchemaConfig {
    'num-byte-slice': number;
    'num-uint': number;
  }

  export class LogicSigBase {
    logic: Uint8Array;
    // args Program arguments as array of Uint8Array arrays
    args: LogicSigArgs;
    sig?: unknown;
    msig?: MultiSig;
  }

  export class LogicSig extends LogicSigBase {
    constructor(program: Uint8Array, args: LogicSigArgs);

    get_obj_for_encoding(): LogicSigBase;
    from_obj_for_encoding(encoded: LogicSigBase): LogicSig;

    // Performs signature verification
    verify(msg: Uint8Array): boolean;
    // Compute hash of the logic sig program (that is the same as escrow account address) as string address
    address(): string;
    // Creates signature (if no msig provided) or multi signature otherwise
    sign(secretKey?: Uint8Array, msig?: MultiSigAccount): void;
    // Signs and appends a signature
    appendToMultisig(secretKey: Uint8Array): void;
    // signs and returns program signature, without appending it to this object
    signProgram(secretKey: Uint8Array): Uint8Array;
    singleSignMultisig(secretKey: Uint8Array, msig: MultiSig): [Uint8Array, number];
    // serializes and encodes the LogicSig
    toByte(): Uint8Array;
    // deserializes a LogicSig which was serialized using toByte()
    fromByte(encoded: Uint8Array): LogicSig;
  }

  export interface TxSig {
    txID: string;
    // blob representing signed transaction data (it's `txn.get_obj_for_encoding()`)
    blob: Uint8Array;
  }

  export function Indexer(...args: any[]): any;

  export function algosToMicroalgos(algos: any): any;

  export function appendSignMultisigTransaction(multisigTxnBlob: any, { version, threshold, addrs }: any, sk: any): any;

  export function assignGroupID(txns: any, from?: any): any;

  export function computeGroupID(txns: any): any;

  export function decodeObj(o: any): any;

  export function encodeObj(o: any): any;

  export function generateAccount(): Account;

  /**
   * isValidAddress takes an Algorand address and checks if valid.
   * @param address Algorand address
   * @returns true if valid, false otherwise
   */
  export function isValidAddress(addr: string): boolean;

  /**
   * decodeAddress takes an Algorand address in string form and decodes it into a Uint8Array(as public key).
   * @param address an Algorand address with checksum.
   * @returns the decoded form of the address's public key and checksum
   */
  export function decodeAddress(a: string): Address;

  /**
   * encodeAddress takes an Algorand address as a Uint8Array and encodes it into a string with checksum.
   * @param address a raw Algorand address
   * @returns the address and checksum encoded as a string.
   */
  export function encodeAddress(a: Uint8Array): string;

  /**
   * multisigAddress takes multisig metadata (preimage) and returns the corresponding human readable Algorand address.
   * @param version mutlisig version
   * @param threshold multisig threshold
   * @param addresses array of encoded addresses
   */
  export function multisigAddress(account: {version: number; threshold: number; addrs: string[]}): string;

  // Calls LogicSig.fromByte
  export function logicSigFromByte(encoded: Uint8Array): LogicSig;

  /**
   * tealSign creates a signature compatible with ed25519verify opcode from contract address
   * @param sk - uint8array with secret key
   * @param data - buffer with data to sign
   * @param contractAddress string representation of teal contract address (program hash)
   */
  export function tealSign(sk: Uint8Array, data: Uint8Array, contractAddress: string): Uint8Array;

  /**
   * tealSignFromProgram creates a signature compatible with ed25519verify opcode from raw program bytes
   * @param sk - uint8array with secret key
   * @param data - buffer with data to sign
   * @param program - buffer with teal program
   */
  export function tealSignFromProgram(sk: Uint8Array, data: Uint8Array, program: Uint8Array): Uint8Array;

  /**
   * encodeUnsignedTransaction takes a completed Transaction object, such as from the makeFoo
   * family of transactions, and converts it to a Buffer
   * @param t the completed Transaction object
   * @returns Uint8Array
   */
  export function encodeUnsignedTransaction(t: Transaction): Uint8Array;

  /**
   * decodeUnsignedTransaction takes a Buffer (as if from encodeUnsignedTransaction) and converts it to a Transaction object
   * @param b the Uint8Array containing a transaction
   * @returns Transaction
   */
  export function decodeUnsignedTransaction(b: Uint8Array): Transaction;

  /**
   * decodeSignedTransaction takes a Buffer (from transaction.signTxn) and converts it to an object
   * containing the Transaction (txn), the signature (sig), and the auth-addr field if applicable (sgnr)
   * @param b the Uint8Array containing a transaction
   * @returns Object containing a Transaction, the signature, and possibly an auth-addr field
   */
  export function decodeSignedTransaction(b: Uint8Array): SignedTransaction;

  export function makeApplicationClearStateTxn(from: string, suggestedParams: SuggestedParams, appIndex: number,
    appArgs?: Uint8Array[], accounts?: string[], foreignApps?: any, foreignAssets?: any,
    note?: Uint8Array, lease?: Uint8Array, rekeyTo?: string): any;

  export function makeApplicationCloseOutTxn(from: string, suggestedParams: SuggestedParams, appIndex: number,
    appArgs?: Uint8Array[], accounts?: string[], foreignApps?: number[], foreignAssets?: number[],
    note?: Uint8Array, lease?: Uint8Array, rekeyTo?: string): any;

  export function makeApplicationCreateTxn(from: string, suggestedParams: SuggestedParams, onComplete: number,
    approvalProgram: any, clearProgram: any, numLocalInts: any, numLocalByteSlices: any,
    numGlobalInts: any, numGlobalByteSlices: any, appArgs?: Uint8Array[], accounts?: string[], foreignApps?: number[],
    foreignAssets?: number[], note?: Uint8Array, lease?: Uint8Array, rekeyTo?: string): any;

  export function makeApplicationDeleteTxn(from: string, suggestedParams: SuggestedParams, appIndex: number,
    appArgs?: Uint8Array[], accounts?: string[], foreignApps?: number[], foreignAssets?: number[], note?: Uint8Array,
    lease?: Uint8Array, rekeyTo?: string): any;

  export function makeApplicationNoOpTxn(from: string, suggestedParams: SuggestedParams, appIndex: number,
    appArgs?: Uint8Array[], accounts?: string[], foreignApps?: number[], foreignAssets?: number[], note?: Uint8Array,
    lease?: Uint8Array, rekeyTo?: string): any;

  export function makeApplicationOptInTxn(from: string, suggestedParams: SuggestedParams, appIndex: number,
    appArgs?: Uint8Array[], accounts?: string[], foreignApps?: number[], foreignAssets?: number[], note?: Uint8Array,
    lease?: Uint8Array, rekeyTo?: string): any;

  export function makeApplicationUpdateTxn(from: string, suggestedParams: SuggestedParams, appIndex: number,
    approvalProgram: any, clearProgram: any, appArgs?: Uint8Array[], accounts?: string[], foreignApps?: number[],
    foreignAssets?: number[], note?: Uint8Array, lease?: Uint8Array, rekeyTo?: string): any;

  export function makeAssetConfigTxn(from: any, fee: any, firstRound: any, lastRound: any,
    note: any, genesisHash: any, genesisID: any, assetIndex: any, manager: any, reserve: any,
    freeze: any, clawback: any, strictEmptyAddressChecking: any): any;

  export function makeAssetConfigTxnWithSuggestedParams(from: any, note: any, assetIndex: any,
    manager: any, reserve: any, freeze: any, clawback: any, suggestedParams: any,
    strictEmptyAddressChecking: any): any;

  export function makeAssetCreateTxn(from: any, fee: any, firstRound: any, lastRound: any,
    note: any, genesisHash: any, genesisID: any, total: any, decimals: any, defaultFrozen: any, manager: any,
    reserve: any, freeze: any, clawback: any, unitName: any, assetName: any, assetURL: any,
    assetMetadataHash: any): any;

  export function makeAssetCreateTxnWithSuggestedParams(from: any, note: any, total: any,
    decimals: any, defaultFrozen: any, manager: any, reserve: any, freeze: any,
    clawback: any, unitName: any, assetName: any, assetURL: any, assetMetadataHash: any,
    suggestedParams: any): Transaction;

  export function makeAssetDestroyTxn(from: any, fee: any, firstRound: any, lastRound: any, note: any, genesisHash: any, genesisID: any, assetIndex: any): any;

  export function makeAssetDestroyTxnWithSuggestedParams(from: any, note: any, assetIndex: any, suggestedParams: any): any;

  export function makeAssetFreezeTxn(from: any, fee: any, firstRound: any, lastRound: any,
    note: any, genesisHash: any, genesisID: any, assetIndex: any, freezeTarget: any, freezeState: any): any;

  export function makeAssetFreezeTxnWithSuggestedParams(from: any, note: any, assetIndex: any, freezeTarget: any, freezeState: any, suggestedParams: any): any;

  export function makeAssetTransferTxn(from: any, to: any, closeRemainderTo: any,
    revocationTarget: any, fee: any, amount: any, firstRound: any, lastRound: any, note: any, genesisHash: any, genesisID: any, assetIndex: any): any;

  export function makeAssetTransferTxnWithSuggestedParams(from: any, to: any, closeRemainderTo: any,
    revocationTarget: any, amount: any, note: any, assetIndex: any, suggestedParams: any): any;

  export function makeKeyRegistrationTxn(from: any, fee: any, firstRound: any, lastRound: any,
    note: any, genesisHash: any, genesisID: any, voteKey: any, selectionKey: any, voteFirst: any, voteLast: any,
    voteKeyDilution: any): any;

  export function makeKeyRegistrationTxnWithSuggestedParams(from: any, note: any, voteKey: any,
    selectionKey: any, voteFirst: any, voteLast: any, voteKeyDilution: any, suggestedParams: any): any;

  export function makeLogicSig(program: Uint8Array, args: LogicSigArgs): LogicSig;

  export function makePaymentTxn(from: any, to: any, fee: any, amount: any, closeRemainderTo: any,
    firstRound: any, lastRound: any, note: any, genesisHash: any, genesisID: any): any;

  export function makePaymentTxnWithSuggestedParams(from: any, to: any, amount: any, closeRemainderTo: any, note: any, suggestedParams: any): any;

  export function masterDerivationKeyToMnemonic(mdk: any): string;

  /**
   * mergeMultisigTransactions takes a list of multisig transaction blobs, and merges them.
   * @param multisigTxnBlobs a list of blobs representing encoded multisig txns
   * @returns typed array msg-pack encoded multisig txn
   */
  export function mergeMultisigTransactions(multisigTxnBlobs: Uint8Array[]): Uint8Array;

  export function microalgosToAlgos(microalgos: any): any;

  export function mnemonicToMasterDerivationKey(mn: string): any;

  export function mnemonicToSecretKey(mn: string): Account;

  export function secretKeyToMnemonic(sk: Uint8Array): string;

  export function signBid(bid: any, sk: any): any;

  /**
   * signBytes takes arbitrary bytes and a secret key, prepends the bytes with "MX" for domain separation, signs the bytes 
   * with the private key, and returns the signature.
   * @param bytes arbitrary bytes
   * @param sk Algorand secret key
   * @returns binary signature
   */
  export function signBytes(bytes: Uint8Array, sk: Uint8Array): Uint8Array;

  /**
   * signLogicSigTransaction takes  a raw transaction and a LogicSig object and returns a logicsig
   * transaction which is a blob representing a transaction and logicsig object.
   * @param Object dictionary containing constructor arguments for a transaction
   * @param lsig logicsig object
   * @returns TxSig - Object containing txID and blob representing signed transaction.
   * @throws error on failure
   */
  export function signLogicSigTransaction(txn: any, lsig: LogicSig): TxSig;

  /**
   * signLogicSigTransactionObject takes transaction.Transaction and a LogicSig object and returns a logicsig
   * transaction which is a blob representing a transaction and logicsig object.
   * @param txn transaction.Transaction
   * @param lsig logicsig object
   * @returns TxSig - Object containing txID and blob representing signed transaction.
   */
  export function signLogicSigTransactionObject(txn: Transaction, lsig: LogicSig): TxSig;

  export function signMultisigTransaction(txn: any, { version, threshold, addrs }: any, sk: any): any;

  export function signTransaction(txn: Transaction, sk: any): any;

  /**
   * verifyBytes takes array of bytes, an address, and a signature and verifies if the signature is correct for the public
   * key and the bytes (the bytes should have been signed with "MX" prepended for domain separation).
   * @param bytes arbitrary bytes
   * @param signature binary signature
   * @param addr string address
   * @returns bool
   */
  export function verifyBytes(bytes: Uint8Array, signature: Uint8Array, addr: string): boolean;

  export namespace ERROR_INVALID_MICROALGOS {
    const message: string;
    const name: string;
    const stack: string;

    function toString(): any;
  }

  export namespace ERROR_MULTISIG_BAD_SENDER {
    const message: string;
    const name: string;
    const stack: string;

    function toString(): any;
  }

  // *************************
  //     Support types

  export class Action<T> {
    do(headers?: Record<string, unknown>): Promise<T>;
  }

  export interface RequestError extends Error {
    response?: {
      statusCode: number;
      text: string;
      body: {
        message: string;
      };
      error?: Error;
    };
    error?: Error;
  }

  export interface NodeStatus {
    catchpoint: string;
    'catchpoint-acquired-blocks': number;
    'catchpoint-processed-accounts': number;
    'catchpoint-total-accounts': number;
    'catchpoint-total-blocks': number;
    'catchup-time': number;
    'last-catchpoint': string;
    'last-round': number;
    'last-version': string;
    'next-version': string;
    'next-version-round': number;
    'next-version-supported': boolean;
    'stopped-at-unsupported-round': boolean;
    'time-since-last-round': number;
  }

  export interface TxResult {
    txId: string;
  }

  export interface ConfirmedTxInfo {
    'confirmed-round': number;
    "asset-index": number;
    'application-index': number;
    'global-state-delta': string;
    'local-state-delta': string;
  }

  export interface SuggestedParams {
    flatFee: boolean;
    fee: number;
    firstRound: number;
    lastRound: number;
    genesisID: string;
    genesisHash: string;
  }

  export interface ParsedAddress {
    publicKey: string;
  }

  export interface Address {
    publicKey: Uint8Array;
    checksum: Uint8Array;
  }

  export type TxnBytes = Uint8Array;

  export interface SSCAttributes {
    'approval-program': string;
    'clear-state-program': string;
    creator: string;
    'global-state': SSCStateSchema[];
    'global-state-schema': SSCSchemaConfig;
    'local-state-schema': SSCSchemaConfig;
  }

  export interface AssetDef {
    creator: string;
    total: number;
    decimals: number;
    'default-frozen': string;
    'unit-name': string;
    name: string;
    url: string;
    'metadata-hash': string;
    manager: string;
    reserve: string;
    freeze: string;
    clawback: string;
  }

  export interface AssetHolding {
    amount: number;
    'asset-id': number;
    creator: string;
    'is-frozen': string;
  }

  export interface CreatedApp {
    id: number;
    params: SSCAttributes;
  }

  export interface CreatedAsset {
    index: number;
    params: AssetDef;
  }

  export interface AppLocalState {
    id: number;
    'key-value': SSCStateSchema[];
    schema: SSCSchemaConfig;
  }

  export interface AccountState {
    address: string;
    assets: AssetHolding[];
    amount: number;
    "amount-without-pending-rewards": number;
    'pending-rewards': number;
    'reward-base': number;
    rewards: number;
    round: number;
    status: string;
    'apps-local-state': AppLocalState[];
    'apps-total-schema': SSCSchemaConfig;
    'created-apps': CreatedApp[];
    'created-assets': CreatedAsset[];
  }

  export interface TxnEncodedObj {
    // common fields
    // https://developer.algorand.org/docs/reference/transactions/#common-fields-header-and-type
    fee: number;
    fv: number;
    lv: number;
    note: Buffer;
    snd: Buffer;
    type: string;
    gen: string;
    gh: Buffer;
    rekey: Buffer;
    lx: Buffer;
    grp: Buffer;

    // Payment Transaction
    // https://developer.algorand.org/docs/reference/transactions/#payment-transaction
    rcv: Buffer;
    amt: number;
    close: Buffer;

    // Key Registration Transaction
    // https://developer.algorand.org/docs/reference/transactions/#key-registration-transaction
    votekey: Buffer;
    selkey: Buffer;
    votefst: number;
    votelst: number;
    votekd: number;

    // Asset Configuration Transaction
    // https://developer.algorand.org/docs/reference/transactions/#asset-configuration-transaction
    caid: number;
    apar: AssetDefEnc;

    // Asset Transfer Transaction
    // https://developer.algorand.org/docs/reference/transactions/#asset-transfer-transaction
    xaid: number;
    aamt: number;
    asnd: Buffer;
    arcv: Buffer;
    aclose: Buffer;

    // Asset Freeze Transaction
    // https://developer.algorand.org/docs/reference/transactions/#asset-freeze-transaction
    fadd: Buffer;
    faid: number;
    afrz: boolean;

    // Application Call Transaction
    // https://developer.algorand.org/docs/reference/transactions/#application-call-transaction
    apid: number;
    apan: TxnOnComplete;
    apat: Buffer[];
    apap: Buffer;
    apaa: Buffer[];
    apsu: Buffer;
    apfa: number[];
    apas: number[];
    apls: StateSchemaEnc;
    apgs: StateSchemaEnc;
  }

  // https://developer.algorand.org/docs/reference/teal/specification/#oncomplete
  enum TxnOnComplete {
    NoOp,
    OptIn,
    CloseOut,
    ClearState,
    UpdateApplication,
    DeleteApplication
  }

  // https://developer.algorand.org/docs/reference/transactions/#asset-parameters
  export interface AssetDefEnc {
    t: number;
    dc: number;
    df: number;
    un: string;
    an: string;
    au: string;
    am: Buffer;
    m: Buffer;
    r: Buffer;
    f: Buffer;
    c: Buffer;
  }

  // https://developer.algorand.org/docs/reference/transactions/#storage-state-schema
  export interface StateSchemaEnc {
    nui: number;
    nbs: number;
  }
}
