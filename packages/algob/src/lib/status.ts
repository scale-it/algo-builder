import { DeployerDeployMode } from "../internal/deployer";

export async function balanceOf (
  deployer: DeployerDeployMode,
  account: string,
  assetid: number
): Promise<void> {
  const accountInfo = await deployer.algodClient.accountInformation(account).do();
  for (const asset of accountInfo.assets) {
    if (asset['asset-id'] === assetid) {
      console.log("Asset Holding Info:", asset, accountInfo);
      break;
    }
  }
};
