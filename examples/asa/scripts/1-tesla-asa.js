const { balanceOf } = require("@algo-builder/algob");
const { mkParam } = require("./transfer/common");

/*
  Create "tesla" Algorand Standard Asset (ASA)
  Accounts are loaded from config
  To use ASA accounts have to opt-in and owner is opt-in by default
  john is transferred some funds to execute opt-in transaction
*/
async function run(runtimeEnv, deployer) {
	console.log("[tesla]: Script has started execution!");

	const masterAccount = deployer.accountsByName.get("master-account");
	const elon = deployer.accountsByName.get("elon-musk");
	const john = deployer.accountsByName.get("john");

	// activate elon account
	await deployer.executeTx(
		mkParam(masterAccount, elon.addr, 40e6, { note: "funding account" })
	);
	await deployer.executeTx(
		mkParam(masterAccount, john.addr, 40e6, { note: "funding account" })
	);

	const asaInfo = await deployer.deployASA("tesla", { creator: elon });
	console.log(asaInfo);

	await deployer.optInAccountToASA(asaInfo.assetIndex, "john", {});

	const assetID = asaInfo.assetIndex;

	console.log("Balance: ", await balanceOf(deployer, elon.addr, assetID));
	// await balanceOf(deployer, john.addr, assetID);

	console.log("[tesla]: Script execution has finished!");
}

module.exports = { default: run };
