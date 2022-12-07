/**
 * Description:
 * This file demonstrates the example to run teal debugger for transfer Algorand
 * Standard Assets(ASA) & MicroAlgos using delegated lsig (between 2 user accounts).
 * You can run it using `algob run scripts/transfer/gold-delegated-lsig.debug.js`
 */
const { types } = require("@algo-builder/web");
const { Tealdbg } = require("@algo-builder/algob");
const { mkParam } = require("./common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const goldOwner = deployer.accountsByName.get("alice");
	const john = deployer.accountsByName.get("john");

	// Transactions for GOLD ASA contract : '4-gold-asa.teal'  (Delegated Approval Mode)
	const lsigGoldOwner = deployer.getLsig("Gold_d_asa_lsig");
	const txnParam = {
		type: types.TransactionType.TransferAsset,
		sign: types.SignType.LogicSignature,
		fromAccountAddr: goldOwner.addr,
		toAccountAddr: john.addr,
		amount: 500,
		assetID: "gold", // passing asa name is also supported
		lsig: lsigGoldOwner,
		payFlags: { totalFee: 1000 },
	};

	const debug = new Tealdbg(deployer, txnParam);

	// Transaction PASS (logic-sig-messages = PASS in assets/dry-run-pass.json)
	await debug.dryRunResponse("dryrun-pass.json");

	/* uncomment below line to start debugger for passing scenario */
	// await debug.run({ tealFile: '4-gold-asa.teal' });

	// Transaction FAIL - rejected by lsig because amount is not <= 1000
	// (logic-sig-messages = "REJECT" in assets/dry-run-fail.json)
	debug.execParams = { ...txnParam, amount: 1500 };
	await debug.dryRunResponse("dryrun-fail.json", true); // passing true overwrites existing .json file

	/* uncomment below line to start debugger for failing scenario */
	await debug.run({ tealFile: "4-gold-asa.py" });

	// setting transaction group in execParams
	// notice that in debugger session Scope.gtxn has 2 transactions
	debug.execParams = [
		mkParam(masterAccount, john.addr, 4e6, {}),
		txnParam,
		{ ...txnParam, amount: 1500 },
	];
	// await debug.run({ tealFile: "4-gold-asa.teal", groupIndex: 1 });
}

module.exports = { default: run };
