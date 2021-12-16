import type { Algodv2, modelsv2 } from "algosdk";

/**
 * Returns `account` balance of `assetID`. Returns 0 if the account has not
 * opt-in to the given asset id.
 * @param deployer algob deployer
 * @param accountAddress account to return assetholding info
 * @param assetID asset index
 */
export async function getAssetHolding (
  algodClient: Algodv2,
  accountAddress: string,
  assetID: number
): Promise<modelsv2.AssetHolding | undefined> {
  const accountInfo = await algodClient.accountInformation(accountAddress).do();
  for (const asset of accountInfo.assets) {
    if (asset["asset-id"] === assetID) {
      return asset;
    }
  }
  return undefined;
}
