import { AlgobDeployer } from "../types";

export async function balanceOf (
  deployer: AlgobDeployer,
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

export async function printAssets (deployer: AlgobDeployer, account: string): Promise<void> {
  const accountInfo = await deployer.algodClient.accountInformation(account).do();
  console.log("Asset Holding Info:", accountInfo.assets);
  console.log("Account's ALGO (microalgos):", accountInfo["amount-without-pending-rewards"]);
}

// read local state of application from user account (stateful smart contract)
export async function readLocalState (
  deployer: AlgobDeployer,
  account: string,
  index: number): Promise<void> {
  const accountInfoResponse = await deployer.algodClient.accountInformation(account).do();
  for (const value of accountInfoResponse['apps-local-state']) {
    if (value.id === index) {
      console.log("User's local state:");
      for (let n = 0; n < value[`key-value`].length; n++) {
        console.log(value[`key-value`][n]);
      }
    }
  }
}

// read global state of application (stateful smart contract)
export async function readGlobalState (
  deployer: AlgobDeployer,
  account: string,
  index: number): Promise<void> {
  const accountInfoResponse = await deployer.algodClient.accountInformation(account).do();
  for (const value of accountInfoResponse['created-apps']) {
    if (value.id === index) {
      console.log("Application's global state:");
      for (let n = 0; n < value.params['global-state'].length; n++) {
        console.log(value.params['global-state'][n]);
      }
    }
  }
}
