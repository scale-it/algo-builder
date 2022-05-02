const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const creator = deployer.accountsByName.get("alice");
	const bob = deployer.accountsByName.get("bob");

	/**
	 * Set level:2 for Alice and Bob (required by smart-contract for asset transfer)
	 * level refers to the minimum required level of user to transfer an asset
	 */
	const appInfo = deployer.getApp("PermissionedTokenApp");
	const setLevelParams = {
		type: types.TransactionType.CallApp,
		sign: types.SignType.SecretKey,
		fromAccount: creator,
		appID: appInfo.appID,
		payFlags: {},
		appArgs: ["str:set-level", "int:2"],
		accounts: [creator.addr], //  AppAccounts
	};

	console.log("* Setting level 2 for Alice and Bob *");
	await deployer.executeTx([setLevelParams]);
	await deployer.executeTx([
		{
			...setLevelParams,
			accounts: [bob.addr],
		},
	]);

	/* uncomment below code to debug (start a debugging session) line 24 */
	// await new Tealdbg(deployer, setLevelParams)
	// .run({ tealFile: 'poi-approval.teal' });

	/* Use below code to clear the min asset level set
    const clearLevelParams = {
      type: types.TransactionType.CallApp,
      sign: types.SignType.SecretKey,
      fromAccount: creator,
      appID: appInfo.appID,
      payFlags: {},
      appArgs: [ "str:clear" ]
    };
    await deployer.executeTx([clearLevelParams]);
  */
}

module.exports = { default: run };
