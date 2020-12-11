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

export const reDigit = /^\d+$/;
