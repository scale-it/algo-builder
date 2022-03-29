const { APP_NAME, accounts } = require("./setup");

// Deploy new application
async function run(runtimeEnv, deployer) {
	const { creator } = accounts(deployer);

	// Create Application
	const appInfo = await deployer.deployApp(
		"app.py",
		"clear.teal",
		{
			sender: creator,
			localInts: 0,
			localBytes: 0,
			globalInts: 0,
			globalBytes: 0,
		},
		{},
		{},
		APP_NAME
	);

	console.log(appInfo);
	console.log("Contracts deployed successfully!");
}

module.exports = { default: run };
