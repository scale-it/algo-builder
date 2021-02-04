export const MIN_UINT64 = 0n;
export const MAX_UINT64 = 0xFFFFFFFFFFFFFFFFn;
export const MAX_UINT8 = 255;
export const MIN_UINT8 = 0;
export const DEFAULT_STACK_ELEM = BigInt("0");
export const MAX_CONCAT_SIZE = 4096;
export const ALGORAND_MIN_TX_FEE = 1000;
export const ALGORAND_ACCOUNT_MIN_BALANCE = 1e6; // 1 ALGO

// values taken from: https://developer.algorand.org/docs/features/asc1/stateful/#minimum-balance-requirement-for-a-smart-contract
// minimum balance costs (in microalgos) for ssc schema
export const APPLICATION_BASE_FEE = 0.1e6; // base fee for creating or opt-in to application
export const ASSET_CREATION_FEE = 0.1e6; // creation fee for asset
export const SSC_KEY_BYTE_SLICE = 25000; // cost for 'key' (always in bytes)
export const SSC_VALUE_UINT = 3500; // cost for value as uint64
export const SSC_VALUE_BYTES = 25000; // cost for value as bytes

// values taken from [https://github.com/algorand/go-algorand/blob/master/config/consensus.go#L691]
export const LogicSigMaxCost = 20000;
export const MaxAppProgramCost = 700;
export const LogicSigMaxSize = 1000;
export const MaxAppProgramLen = 1024;

export const MAX_ALGORAND_ACCOUNT_ASSETS = 1000;
export const MAX_ALGORAND_ACCOUNT_APPS = 10;

const zeroAddress = new Uint8Array(32);
const zeroUint64 = BigInt('0');
const zeroByte = new Uint8Array(0);

// https://developer.algorand.org/docs/reference/teal/opcodes/#txn
// transaction fields supported by teal v1
export const TxnFields: {[key: number]: {[key: string]: any}} = {
  1: {
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
    TxID: ''
  }
};

// transaction fields supported by teal v2
TxnFields[2] = {
  ...TxnFields[1],
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
  FreezeAssetFrozen: 'afrz'
};

export const TxFieldDefaults: {[key: string]: any} = {
  Sender: zeroAddress,
  Fee: zeroUint64,
  FirstValid: zeroUint64,
  LastValid: zeroUint64,
  Note: zeroByte,
  Lease: zeroByte,
  Receiver: zeroAddress,
  Amount: zeroUint64,
  CloseRemainderTo: zeroAddress,
  VotePK: zeroAddress,
  SelectionPK: zeroAddress,
  VoteFirst: zeroUint64,
  VoteLast: zeroUint64,
  VoteKeyDilution: zeroUint64,
  Type: zeroByte,
  TypeEnum: zeroUint64,
  XferAsset: zeroUint64,
  AssetAmount: zeroUint64,
  AssetSender: zeroAddress,
  AssetReceiver: zeroAddress,
  AssetCloseTo: zeroAddress,
  GroupIndex: zeroUint64,
  ApplicationID: zeroUint64,
  OnCompletion: zeroUint64,
  ApplicationArgs: zeroByte,
  NumAppArgs: zeroUint64,
  Accounts: zeroByte,
  NumAccounts: zeroUint64,
  ApprovalProgram: zeroByte,
  ClearStateProgram: zeroByte,
  RekeyTo: zeroAddress,
  ConfigAsset: zeroUint64,
  ConfigAssetTotal: zeroUint64,
  ConfigAssetDecimals: zeroUint64,
  ConfigAssetDefaultFrozen: zeroUint64,
  ConfigAssetUnitName: zeroByte,
  ConfigAssetName: zeroByte,
  ConfigAssetURL: zeroByte,
  ConfigAssetMetadataHash: zeroByte,
  ConfigAssetManager: zeroAddress,
  ConfigAssetReserve: zeroAddress,
  ConfigAssetFreeze: zeroAddress,
  ConfigAssetClawback: zeroAddress,
  FreezeAsset: zeroUint64,
  FreezeAssetAccount: zeroAddress,
  FreezeAssetFrozen: zeroUint64
};

export const AssetParamMap: {[key: string]: string} = {
  AssetTotal: 'total', // Total number of units of this asset
  AssetDecimals: 'decimals', // See AssetDef.Decimals
  AssetDefaultFrozen: 'default-frozen', // Frozen by default or not
  AssetUnitName: 'unit-name', // Asset unit name
  AssetName: 'name', // Asset name
  AssetURL: 'url', // URL with additional info about the asset
  AssetMetadataHash: 'metadata-hash', // Arbitrary commitment
  AssetManager: 'manager', // Manager commitment
  AssetReserve: 'reserve', // Reserve address
  AssetFreeze: 'freeze', // Freeze address
  AssetClawback: 'clawback' // Clawback address
};

export const reDigit = /^\d+$/;

/** is Base64 regex
 * * ^                          # Start of input
 * ([0-9a-zA-Z+/]{4})*        # Groups of 4 valid characters decode
 *                            # to 24 bits of data for each group
 * (                          # Either ending with:
 *     ([0-9a-zA-Z+/]{2}==)   # two valid characters followed by ==
 *     |                      # , or
 *     ([0-9a-zA-Z+/]{3}=)    # three valid characters followed by =
 * )?                         # , or nothing
 * $                          # End of input
 */
export const reBase64 = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

// A-Z and 2-7 repeated, with optional `=` at the end
export const reBase32 = /^[A-Z2-7]+=*$/;

// reference for values: https://github.com/algorand/go-algorand/blob/master/config/consensus.go#L510
// for fields: https://developer.algorand.org/docs/reference/teal/opcodes/#global
// global field supported by teal v1
export const GlobalFields: {[key: number]: {[key: string]: any}} = { // teal version => global field => value
  1: {
    MinTxnFee: ALGORAND_MIN_TX_FEE,
    MinBalance: 10000,
    MaxTxnLife: 1000,
    ZeroAddress: zeroAddress,
    GroupSize: ''
  }
};

// global field supported by teal v2
GlobalFields[2] = {
  ...GlobalFields[1],
  LogicSigVersion: 2, // LogicSigVersion >= 2
  Round: 500, // constant (for tests)
  LatestTimestamp: Math.round((new Date()).getTime() / 1000),
  CurrentApplicationID: ''
};

// creating map for opcodes whose cost is other than 1
export const OpGasCost: {[key: number]: {[key: string]: number}} = { // version => opcode => cost
  // v1 opcodes cost
  1: {
    sha256: 7,
    sha512_256: 9,
    keccak256: 26,
    ed25519verify: 1900
  }
};
// v2 opcodes cost
OpGasCost[2] = {
  ...OpGasCost[1], // includes all v1 opcodes
  sha256: 35,
  sha512_256: 45,
  keccak256: 130
};
