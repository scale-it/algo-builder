import type { AssetHolding, SSCStateSchema } from "algosdk";

import { AlgobDeployer } from "../types";

/// Returns `account` asset holding of `assetID`. Returns undefined if the account is not
/// opt-in to the given asset id.
export async function balanceOf (
  deployer: AlgobDeployer,
  account: string,
  assetID: number
): Promise<AssetHolding | undefined> {
  const accountInfo = await deployer.algodClient.accountInformation(account).do();
  for (const asset of accountInfo.assets) {
    if (asset['asset-id'] === assetID) {
      console.log("Asset Holding Info:", asset);
      return asset;
    }
  }
  return undefined;
};

/**
 * Description: Function to read and return the global state of application.
 * @param deployer AlgobDeployer
 * @param creator Account from which call needs to be made
 * @param appId ID of the application being configured or empty if creating
 */
export async function readGlobalStateSSC (
  deployer: AlgobDeployer,
  creator: string,
  appId: number): Promise<SSCStateSchema[] | undefined> {
  const accountInfoResponse = await deployer.algodClient.accountInformation(creator).do();
  for (const app of accountInfoResponse['created-apps']) {
    if (app.id === appId) { return app.params['global-state']; }
  }
  return undefined;
}

/**
 * Description: Function to read and return the local state of application from an account.
 * @param deployer AlgobDeployer
 * @param account account from the which the local state has to be read
 * @param appId ID of the application being configured or empty if creating
 */
export async function readLocalStateSSC (
  deployer: AlgobDeployer,
  account: string,
  appId: number): Promise<SSCStateSchema[] | undefined> {
  const accountInfoResponse = await deployer.algodClient.accountInformation(account).do();
  for (const app of accountInfoResponse['apps-local-state']) {
    if (app.id === appId) { return app[`key-value`]; }
  }
  return undefined;
}

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
  const localState = await readLocalStateSSC(deployer, account, appId);
  if (localState === undefined) { return; }
  console.log("User's local state:");
  for (let n = 0; n < localState.length; n++) {
    console.log(localState[n]);
  }
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
