import type { Account } from "algosdk";

import { AlgobDeployer, NFT, SSCStateSchema } from "../types";
import { callNoOp } from "./ssc";
import { readGlobalStateSSC, readLocalStateSSC } from "./status";

// generate random 32 char hash
function _NFTToken (): string {
  return Array(32).fill(0).map(x => Math.random().toString(36).charAt(2)).join('');
}

/**
 * Description: This function creates a new Non-Fungible-Token
 * @param deployer AlgobDeployer
 * @param sender Account from which call needs to be made
 * @param appId application ID
 * @param nft contains name of nft
 */
export async function createNewNFT (
  deployer: AlgobDeployer,
  creater: Account,
  appId: number,
  nft: NFT
): Promise<void> {
  const globalState = await readGlobalStateSSC(deployer, creater.addr, appId) as SSCStateSchema[];
  if (globalState === undefined) {
    console.warn(creater.addr + " is not the smart contract admin");
    return;
  }

  for (const g of globalState) {
    const key = Buffer.from(g.key, 'base64').toString();
    if (key === nft.name) {
      throw new Error("Non Fungible Token with name " + nft.name + " already exists");
    }
  }

  nft.url = _NFTToken();

  const appArgs = [];
  appArgs.push(new Uint8Array(Buffer.from("create")));
  appArgs.push(new Uint8Array(Buffer.from(nft.name)));
  appArgs.push(new Uint8Array(Buffer.from(nft.url)));

  await callNoOp(deployer, creater, {}, appId, appArgs);
}

/**
 * Description: This function trasfers a Non-Fungible-Token from
 * fromAccount to toAccountAddr's local state
 * @param deployer AlgobDeployer
 * @param fromAccount Account from which call needs to be made
 * @param toAccountAddr account to which nft should be transferred to
 * @param nft contains name of nft
 */
export async function transferNFT (
  deployer: AlgobDeployer,
  fromAccount: Account,
  toAccountAddr: string,
  appId: number,
  nft: NFT
): Promise<void> {
  const localState = await readLocalStateSSC(deployer, fromAccount.addr, appId) as SSCStateSchema[];
  if (localState === undefined) { return; }

  let key;
  for (const l of localState) {
    key = Buffer.from(l.key, 'base64').toString();
    if (key === nft.name) { break; }
  }

  if (key !== nft.name) {
    throw new Error("Account " + fromAccount.addr + " does not hold NFT " + nft.name);
  }

  const appArgs = []; const accounts = [];
  appArgs.push(new Uint8Array(Buffer.from("transfer")));
  appArgs.push(new Uint8Array(Buffer.from(nft.name)));

  // pass both accounts to ssc
  accounts.push(fromAccount.addr);
  accounts.push(toAccountAddr);

  await callNoOp(deployer, fromAccount, {}, appId, appArgs, accounts);
}
