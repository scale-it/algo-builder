/**
 * Description:
 * This file demonstrates how to create ASA owned by
 * smart contract account(stateless).
 * Steps:
 * - Deploy SSC (controls asa)
 * - Create contract account (with app_id embedded/passed as a template param)
 * - Deploy ASA using both contracts
 */
const { mkParam, tryExecuteTx } = require("./transfer/common");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const alice = deployer.accountsByName.get("alice");

	await tryExecuteTx(
		deployer,
		mkParam(masterAccount, alice.addr, 200e6, { note: "funding account" })
	);

	// Create Application
	// Note: An Account can have maximum of 10 Applications.
	const appInfo = await deployer
		.deployApp(
			alice,
			{
				appName: "StatefulASA_App",
				metaType: types.MetaType.FILE,
				approvalProgramFilename: "5-contract-asa-stateful.py", // approval program
				clearProgramFilename: "5-clear.py", // clear program
				localInts: 1,
				localBytes: 1,
				globalInts: 1,
				globalBytes: 1,
			},
			{}
		)
		.catch((error) => {
			throw error;
		});

	console.log(appInfo);

	// Get Statless Account Address
	await deployer
		.mkContractLsig("StateLessASALsig", "5-contract-asa-stateless.py", {
			APP_ID: appInfo.appID,
		})
		.catch((error) => {
			throw error;
		});
	const statelessAccount = deployer.getLsig("StateLessASALsig");
	console.log("stateless Account Address:", statelessAccount.address());

	await tryExecuteTx(
		deployer,
		mkParam(masterAccount, statelessAccount.address(), 200e6, { note: "funding account" })
	);

	const txGroup = [
		// Stateful call
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: alice,
			appID: appInfo.appID,
			payFlags: { totalFee: 1000 },
		},
		// Asset creation
		{
			type: types.TransactionType.DeployASA,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: statelessAccount.address(),
			asaName: "platinum",
			lsig: statelessAccount,
			payFlags: { totalFee: 1000 },
		},
		// Payment of 1 algo signed by alice
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: alice,
			toAccountAddr: statelessAccount.address(),
			amountMicroAlgos: 1e6,
			payFlags: { totalFee: 1000 },
		},
	];

	await tryExecuteTx(deployer, txGroup);

	// This should fail because maximum number of asa creation limit is set to 1
	try {
		txGroup[1].asaName = "alu";
		await tryExecuteTx(deployer, txGroup);
	} catch (e) {
		console.log(e.response?.error);
	}
}

module.exports = { default: run };
