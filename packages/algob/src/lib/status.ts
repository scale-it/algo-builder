import type { SSCStateSchema } from "algosdk";

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

// print user state of a stateful smart contract
export async function printLocalStateSSC (
  deployer: AlgobDeployer,
  account: string,
  appId: number): Promise<void> {
  const accountInfoResponse = await deployer.algodClient.accountInformation(account).do();
  for (const value of accountInfoResponse['apps-local-state']) {
    if (value.id === appId) {
      console.log("User's local state:");
      for (let n = 0; n < value[`key-value`].length; n++) {
        console.log(value[`key-value`][n]);
      }
    }
  }
}

export async function readGlobalStateSSC (
  deployer: AlgobDeployer,
  creator: string,
  appId: number): Promise<SSCStateSchema[] | undefined> {
  const accountInfoResponse = await deployer.algodClient.accountInformation(creator).do();
  for (const value of accountInfoResponse['created-apps']) {
    if (value.id === appId) {
      return value.params['global-state'];
    }
  }
  return undefined;
}

// print global state of a stateful smart contract
export async function printGlobalStateSSC (
  deployer: AlgobDeployer,
  creator: string,
  appId: number): Promise<void> {
  const globalState = await readGlobalStateSSC(deployer, creator, appId);
  if (globalState === undefined) { return; }
  console.log("Application's global state:");
  for (let n = 0; n < globalState.length; n++) {
    console.log(globalState[n]);
  }
}
