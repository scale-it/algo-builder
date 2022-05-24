import * as algob from "@algo-builder/algob";

async function run(
	runtimeEnv: algob.types.RuntimeEnv,
	deployer: algob.types.Deployer
): Promise<void> {
	console.log("Sample script for ASC has started execution!");
	await deployer.mkContractLsig("feeCheck", "fee-check.teal");
	await deployer.fundLsig(
		"feeCheck",
		{ funder: deployer.accounts[0], fundingMicroAlgo: 20e6 },
		{}
	);

	await deployer.addCheckpointKV("User Checkpoint", "Fund Contract Account");
	console.log("Sample script for ASC Funding execution has finished!");
}

module.exports = { default: run };
