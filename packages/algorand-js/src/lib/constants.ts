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

// Table https://developer.algorand.org/docs/reference/teal/opcodes/?query=mulw#txn
export const TX_FIELD_MAP: {[key: string]: string} = {
  0: "Sender",
  1: "Fee",
  2: "FirstValid",
  3: "FirstValidTime",
  4: "LastValid",
  5: "Note",
  6: "Lease",
  7: "Receiver",
  8: "Amount",
  9: "CloseRemainderTo",
  10: "VotePK",
  11: "SelectionPK",
  12: "VoteFirst",
  13: "VoteLast",
  14: "VoteKeyDilution",
  15: "Type",
  16: "TypeEnum",
  17: "XferAsset",
  18: "AssetAmount",
  19: "AssetSender",
  20: "AssetReceiver",
  21: "AssetCloseTo",
  22: "GroupIndex",
  23: "TxID",
  24: "ApplicationID",
  25: "OnCompletion",
  26: "ApplicationArgs",
  27: "NumAppArgs",
  28: "Accounts",
  29: "NumAccounts",
  30: "ApprovalProgram",
  31: "ClearStateProgram",
  32: "RekeyTo",
  33: "ConfigAsset",
  34: "ConfigAssetTotal",
  35: "ConfigAssetDecimals",
  36: "ConfigAssetDefaultFrozen",
  37: "ConfigAssetUnitName",
  38: "ConfigAssetName",
  39: "ConfigAssetURL",
  40: "ConfigAssetMetadataHash",
  41: "ConfigAssetManager",
  42: "ConfigAssetReserve",
  43: "ConfigAssetFreeze",
  44: "ConfigAssetClawback",
  45: "FreezeAsset",
  46: "FreezeAssetAccount",
  47: "FreezeAssetFrozen"
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
