// https://docs.microsoft.com/en-us/dotnet/api/system.uint64.maxvalue?view=net-5.0
export const MAX_UINT64 = BigInt("18446744073709551615");
export const MIN_UINT64 = BigInt("0");
export const MAX_UINT8 = 255;
export const MIN_UINT8 = 0;
export const DEFAULT_STACK_ELEM = BigInt("0");
export const MAX_CONCAT_SIZE = 4096;
const zeroAddress = new Uint8Array(32);
const zeroUint64 = BigInt('0');
const zeroByte = new Uint8Array(0);

// https://developer.algorand.org/docs/reference/teal/opcodes/#txn
export const TxnFields: {[key: string]: string} = {
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
