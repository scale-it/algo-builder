/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
 * In this scheme, the buyer funds a TEAL account with the sale price.
 * The buyer also picks a secret value and encodes a secure hash of this value in
 * the TEAL program. The TEAL program will transfer its balance to the seller
 * if the seller is able to provide the secret value that corresponds to the hash in the program.
*/
import { stringToBytes } from "@algorand-builder/algob";
import * as algob from "@algorand-builder/algob";
import { types as rtypes } from "@algorand-builder/runtime";

import { executeTx, prepareParameters } from "./common";

async function run (
  runtimeEnv: algob.types.AlgobRuntimeEnv, deployer: algob.types.AlgobDeployer): Promise<void> {
  const { alice, scTmplParams, secret } = prepareParameters(deployer);
  const wrongSecret = 'hero wisdom red split loop element vote belt';

  let lsig = await deployer.loadLogic('htlc.py', [stringToBytes(wrongSecret)], scTmplParams);
  let sender = lsig.address();

  const txnParams: rtypes.AlgoTransferParam = {
    type: rtypes.TransactionType.TransferAlgo,
    sign: rtypes.SignType.LogicSignature,
    fromAccount: { addr: sender, sk: new Uint8Array(0) }, // we don't need secret key for logic signature account so added a dummy
    toAccountAddr: alice.addr,
    amountMicroAlgos: 200,
    lsig: lsig,
    payFlags: { totalFee: 1000 }
  };
  // Transaction Fails : as wrong secret value is used
  await executeTx(deployer, txnParams);

  lsig = await deployer.loadLogic('htlc.py', [stringToBytes(secret)], scTmplParams);
  sender = lsig.address();

  // Transaction Passes : as right secret value is used
  txnParams.fromAccount = { addr: sender, sk: new Uint8Array(0) };
  txnParams.lsig = lsig;
  await executeTx(deployer, txnParams);
}

module.exports = { default: run };
