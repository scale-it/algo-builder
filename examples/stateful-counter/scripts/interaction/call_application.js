const { readAppGlobalState } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const creatorAccount = deployer.accountsByName.get("alice");

	// Retreive AppInfo from checkpoints.
	const appInfo = deployer.getApp("CounterApp");
	const applicationID = appInfo.appID;
	console.log("Application Id ", applicationID);

	// Retreive Global State
	let globalState = await readAppGlobalState(deployer, creatorAccount.addr, applicationID);
	console.log(globalState);

	const tx = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: creatorAccount,
		appID: applicationID,
		payFlags: {},
	};

	await deployer.executeTx([tx]);

	/* Uncomment below code to start debugger  */
	// await new Tealdbg(deployer, tx)
	//   .run({ tealFile: "approval_program.teal" });

	globalState = await readAppGlobalState(deployer, creatorAccount.addr, applicationID);
	console.log(globalState);
}

module.exports = { default: run };
