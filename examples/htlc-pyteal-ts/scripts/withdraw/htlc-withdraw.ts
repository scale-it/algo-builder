/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
 * In this scheme, the buyer funds a TEAL account with the sale price.
 * The buyer also picks a secret value and encodes a secure hash of this value in
 * the TEAL program. The TEAL program will transfer its balance to the seller
 * if the seller is able to provide the secret value that corresponds to the hash in the program.
*/
import * as algob from "@algo-builder/algob";
import { types as rtypes } from "@algo-builder/runtime";

import { executeTx, prepareParameters } from "./common";

async function run (
  runtimeEnv: algob.types.RuntimeEnv, deployer: algob.types.Deployer): Promise<void> {
  const { alice, scTmplParams, secret } = prepareParameters(deployer);
  const wrongSecret = 'hero wisdom red split loop element vote belt';

  const lsig = await deployer.loadLogic('htlc.py', scTmplParams);
  const sender = lsig.address();

  const txnParams: rtypes.AlgoTransferParam = {
    type: rtypes.TransactionType.TransferAlgo,
    sign: rtypes.SignType.LogicSignature,
    fromAccountAddr: sender, // we don't need secret key for logic signature account so added a dummy
    toAccountAddr: alice.addr,
    amountMicroAlgos: 200,
    lsig: lsig,
    args: [algob.convert.stringToBytes(wrongSecret)],
    payFlags: { totalFee: 1000 }
  };
  // Transaction Fails : as wrong secret value is used
  await executeTx(deployer, txnParams);

  // Transaction Passes : as right secret value is used
  txnParams.args = [algob.convert.stringToBytes(secret)];
  await executeTx(deployer, txnParams);
}

module.exports = { default: run };
