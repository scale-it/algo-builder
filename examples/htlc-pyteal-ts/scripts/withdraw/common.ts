import { executeTransaction } from "@algorand-builder/algob";
import { Account, AlgobDeployer, ExecParams } from "@algorand-builder/algob/src/types";
import { sha256 } from 'js-sha256';

export function getDeployerAccount (deployer: AlgobDeployer, name: string): Account {
  const account = deployer.accountsByName.get(name);
  if (account === undefined) {
    throw new Error(`Account ${name} is not defined`);
  }
  return account;
}

export async function executeTx (deployer: AlgobDeployer, txnParams: ExecParams): Promise<void> {
  try {
    await executeTransaction(deployer, txnParams);
  } catch (e) {
    console.error('Transaction Failed', e.response ? e.response.error : e.error);
  }
};

export function prepareParameters (deployer: AlgobDeployer): any {
  const bob = getDeployerAccount(deployer, 'bob');
  const alice = getDeployerAccount(deployer, 'alice');

  const secret = 'hero wisdom green split loop element vote belt';
  const secretHash = Buffer.from(sha256.digest(secret)).toString('base64');

  const scTmplParams = { bob: bob.addr, alice: alice.addr, hash_image: secretHash };
  return { alice, bob, secret, scTmplParams, secretHash };
};
