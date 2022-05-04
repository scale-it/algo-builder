async function run(runtimeEnv, deployer) {
	if (deployer.isDeployMode) {
		await deployer.fundLsigByFile(
			"fee-check.teal",
			{ funder: deployer.accounts[0], fundingMicroAlgo: 100000000 },
			{}
		);
	}
}

module.exports = { default: run };
