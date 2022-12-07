async function run(runtimeEnv, deployer, arg) {
	const parsedArg = JSON.parse(arg);
	const appID = parseInt(parsedArg.appID);
	const creatorAccount = deployer.accountsByName.get("alice");

	console.log("Opting application: ", appID);

	// Opt-In for creator
	await deployer.optInAccountToApp(creatorAccount, appID, {}, {}).catch((error) => {
		throw error;
	});

	console.log("Successfully opted application: ", appID);
}

module.exports = { default: run };
