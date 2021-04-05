import { executeTransaction } from "@algo-builder/algob";
import * as algob from "@algo-builder/algob";
import { types as rtypes } from "@algo-builder/runtime";
import { sha256 } from 'js-sha256';

/**
 * Returns account from algob config (by name)
 * @param deployer Deployer
 * @param name Name of the account to fetch
 */
export function getDeployerAccount (
  deployer: algob.types.Deployer, name: string): rtypes.Account {
  const account = deployer.accountsByName.get(name);
  if (account === undefined) {
    throw new Error(`Account ${name} is not defined`);
  }
  return account;
}

export async function executeTx (
  deployer: algob.types.Deployer, txnParams: rtypes.ExecParams): Promise<void> {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e.error);
  }
};

/**
 * Prepares parameters for htlc run and deploy tasks
 *  - alice account
 *  - bob account
 *  - secret value
 *  - hash of secret
 *  - pyteal template params (to pass to htlc.py)
 * @param deployer Deployer
 */
export function prepareParameters (deployer: algob.types.Deployer): any {
  const bob = getDeployerAccount(deployer, 'bob');
  const alice = getDeployerAccount(deployer, 'alice');

  const secret = 'hero wisdom green split loop element vote belt';
  const secretHash = Buffer.from(sha256.digest(secret)).toString('base64');

  const scTmplParams = { bob: bob.addr, alice: alice.addr, hash_image: secretHash };
  return { alice, bob, secret, scTmplParams, secretHash };
};
