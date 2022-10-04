const { mkParam, tryExecuteTx } = require("./common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const john = deployer.accountsByName.get("john");

	// fund John account with 1 Algo
	await tryExecuteTx(deployer, mkParam(masterAccount, john.addr, 1e6, { note: "ALGO PAID" }));
}

module.exports = { default: run };
