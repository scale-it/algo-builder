import { status } from "@algo-builder/web";

import { AccountAddress, Deployer, Key, StateValue } from "../types";

/**
 * Returns `account` balance of `assetID`. Returns 0 if the account has not
 * opt-in to the given asset id.
 * @param deployer algob deployer
 * @param accountAddress account to return assetholding info
 * @param assetID asset index. If assetID is undefined the account algo balance will return
 */
export async function balanceOf(
	deployer: Deployer,
	accountAddress: AccountAddress,
	assetID?: number
): Promise<number | bigint> {
	if (assetID === undefined) {
		const accountInfo = await deployer.algodClient.accountInformation(accountAddress).do();
		// amount of account
		return accountInfo.amount;
	}

	const a = await status.getAssetHolding(deployer.algodClient, accountAddress, assetID);
	if (a === undefined) return 0n;
	return a.amount;
}

/**
 * fetches and returns the global state of application.
 * @param deployer Deployer
 * @param creator Account from which call needs to be made
 * @param appID ID of the application being configured or empty if creating
 */
export async function readAppGlobalState(
	deployer: Deployer,
	creator: AccountAddress,
	appID: number
): Promise<Map<Key, StateValue> | undefined> {
	const accountInfoResponse = await deployer.algodClient.accountInformation(creator).do();
	for (const app of accountInfoResponse["created-apps"]) {
		if (app.id === appID) {
			const globalStateMap = new Map<Key, StateValue>();
			for (const g of app.params["global-state"]) {
				const key = Buffer.from(g.key, "base64").toString();
				if (g.value.type === 1) {
					globalStateMap.set(key, g.value.bytes);
				} else {
					globalStateMap.set(key, g.value.uint);
				}
			}
			return globalStateMap;
		}
	}
	return undefined;
}

/**
 * Read and return the local state of application from an account.
 * @param deployer Deployer
 * @param account account from the which the local state has to be read
 * @param appID ID of the application being configured or empty if creating
 */
export async function readAppLocalState(
	deployer: Deployer,
	account: AccountAddress,
	appID: number
): Promise<Map<Key, StateValue> | undefined> {
	const accountInfoResponse = await deployer.algodClient.accountInformation(account).do();
	for (const app of accountInfoResponse["apps-local-state"]) {
		if (app.id === appID && app["key-value"]) {
			const localStateMap = new Map<Key, StateValue>();
			for (const g of app[`key-value`]) {
				const key = Buffer.from(g.key, "base64").toString();
				if (g.value.type === 1) {
					localStateMap.set(key, g.value.bytes);
				} else {
					localStateMap.set(key, g.value.uint);
				}
			}
			return localStateMap;
		}
	}
	return undefined;
}

/**
 * Prints account asset holdings and ALGO balance (in microalgos)
 * @param deployer algob deployer object
 * @param account account whose asset holding to print
 */
export async function printAssets(deployer: Deployer, account: string): Promise<void> {
	const accountInfo = await deployer.algodClient.accountInformation(account).do();
	console.log("Asset Holding Info:", accountInfo.assets);
	console.log("Account's ALGO (microalgos):", accountInfo["amount-without-pending-rewards"]);
}

/**
 * print account's local state of a stateful smart contract
 * @param deployer algob deployer
 * @param accountAddr account address to print local state
 * @param appID application index of smart contract
 */
export async function printLocalStateApp(
	deployer: Deployer,
	accountAddr: AccountAddress,
	appID: number
): Promise<void> {
	const localState = await readAppLocalState(deployer, accountAddr, appID);
	if (localState === undefined) {
		return;
	}
	console.log("User's local state:");
	console.log(localState);
}

/**
 * print global state of a stateful smart contract
 * @param deployer algob deployer
 * @param creatorAddr creator address of stateful smart contract
 * @param appID application index of smart contract
 */
export async function printGlobalStateApp(
	deployer: Deployer,
	creatorAddr: AccountAddress,
	appID: number
): Promise<void> {
	const globalState = await readAppGlobalState(deployer, creatorAddr, appID);
	if (globalState === undefined) {
		return;
	}
	console.log("Application's global state:");
	console.log(globalState);
}
