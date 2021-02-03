/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
*/
import { executeTransaction } from "@algorand-builder/algob";
import { AlgobDeployer, AlgobRuntimeEnv } from "@algorand-builder/algob/src/types";
import { SignType, TransactionType } from "@algorand-builder/runtime/build/types";
import { AlgoTransferParam } from "@algorand-builder/runtime/src/types";

import { getDeployerAccount, prepareParameters } from "./withdraw/common";

async function run (runtimeEnv: AlgobRuntimeEnv, deployer: AlgobDeployer): Promise<void> {
  const masterAccount = getDeployerAccount(deployer, 'master-account');
  const { alice, bob, scTmplParams } = prepareParameters(deployer);

  /** ** firstly we fund Alice and Bob accounts ****/
  const bobFunding: AlgoTransferParam = {
    type: TransactionType.TransferAlgo,
    sign: SignType.SecretKey,
    fromAccount: masterAccount,
    toAccountAddr: bob.addr,
    amountMicroAlgos: 10e6, // 10 Algos
    payFlags: { note: 'funding account' }
  };
  // We need to copy, because the executeTransaction is async
  const aliceFunding = Object.assign({}, bobFunding);
  aliceFunding.toAccountAddr = alice.addr;
  aliceFunding.amountMicroAlgos = 0.1e6; // 0.1 Algo
  await Promise.all([
    executeTransaction(deployer, bobFunding),
    executeTransaction(deployer, aliceFunding)
  ]);

  /** ** now bob creates and deploys the escrow account ****/
  console.log('hash of the secret:', scTmplParams.hash_image);
  // hash: QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=

  await deployer.fundLsig('htlc.py',
    { funder: bob, fundingMicroAlgo: 2e6 }, {}, [], scTmplParams);

  // Add user checkpoint
  deployer.addCheckpointKV('User Checkpoint', 'Fund Contract Account');
}

module.exports = { default: run };
