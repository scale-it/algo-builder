/**
 * In this script we will fund an escrow contract. The escrow contract
 * ensures the payment is made out(from the escrow) to a specific receiver only.
 * This receiver address is hardcoded in the smart contract, and can be passed
 * dynamically to the contract using fundLsigByFile function (passed as a template parameter)
 */
import * as algob from "@algo-builder/algob";

async function run(
	runtimeEnv: algob.types.RuntimeEnv,
	deployer: algob.types.Deployer
): Promise<void> {
	console.log("Escrow account script execution started!");

	// RECEIVER_ADDRESS is set in escrow.py when it is compiled from PyTEAL to TEAL
	const templateParams = {
		RECEIVER_ADDRESS: "WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY",
	};
	await deployer.mkContractLsig("escrow", "escrow.py", templateParams);

	await deployer.fundLsig(
		"escrow",
		{ funder: deployer.accounts[0], fundingMicroAlgo: 20e6 },
		{ totalFee: 1000 }
	);
	const escrow = await deployer.getLsig("escrow");

	if (escrow === undefined) {
		return;
	}
	await deployer.addCheckpointKV(
		"User Checkpoint Escrow",
		`Fund Escrow Account: ${escrow.address()}`
	);
	console.log("Escrow account script execution finished!");
}

module.exports = { default: run };
