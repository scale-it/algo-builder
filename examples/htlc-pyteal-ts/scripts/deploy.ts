/**
 * Description:
 * This file demonstrates the PyTeal Example for HTLC(Hash Time Lock Contract)
 */
import * as algob from "@algo-builder/algob";
import { types as rtypes } from "@algo-builder/web";

import { getDeployerAccount, prepareParameters, tryExecuteTx } from "./withdraw/common";

async function run(
	runtimeEnv: algob.types.RuntimeEnv,
	deployer: algob.types.Deployer
): Promise<void> {
	const masterAccount = getDeployerAccount(deployer, "master-account");
	const { alice, bob, scTmplParams } = prepareParameters(deployer);

	/** ** firstly we fund Alice and Bob accounts ****/
	const bobFunding: rtypes.AlgoTransferParam = {
		type: rtypes.TransactionType.TransferAlgo,
		sign: rtypes.SignType.SecretKey,
		fromAccount: masterAccount,
		toAccountAddr: bob.addr,
		amountMicroAlgos: 10e6, // 10 Algos
		payFlags: { note: "funding account" },
	};
	// We need to copy, because the executeTx is async
	const aliceFunding = Object.assign({}, bobFunding);
	aliceFunding.toAccountAddr = alice.addr;
	aliceFunding.amountMicroAlgos = 5e6; // 5 Algo
	await Promise.all([tryExecuteTx(deployer, [bobFunding]), tryExecuteTx(deployer, [aliceFunding])]);

	/** ** now bob creates and deploys the escrow account ****/
	console.log("hash of the secret:", scTmplParams.hash_image);
	// hash: QzYhq9JlYbn2QdOMrhyxVlNtNjeyvyJc/I8d8VAGfGc=

	await deployer.mkContractLsig("HTLC_Lsig", "htlc.py", scTmplParams).catch((error) => {
		throw error;
	});

	deployer.fundLsig("HTLC_Lsig", { funder: bob, fundingMicroAlgo: 5e6 }, {})

	// Add user checkpoint
	deployer.addCheckpointKV("User Checkpoint", "Fund Contract Account");
}

module.exports = { default: run };
