const { tryExecuteTx, mkTxnParams } = require("./common/common");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const john = deployer.accountsByName.get("john");
	const bob = deployer.accountsByName.get("bob");

	const scInitParam = {
		TMPL_TO: john.addr,
		ARG_AMT: 700000,
		ARG_CLS: masterAccount.addr,
		ARG_FV: 10,
		ARG_LV: 1000000,
		ARG_LEASE: "023sdDE2",
	};
	const contractName = "dynamic-fee.py";
	// setup a contract account and send 1 ALGO from master
	await deployer.fundLsigByFile(
		contractName,
		{ funder: masterAccount, fundingMicroAlgo: 100000000 },
		{ closeRemainderTo: masterAccount.addr },
		scInitParam
	);

	const contract = await deployer.loadLogicByFile(contractName, scInitParam);
	const escrow = contract.address(); // contract account

	await deployer.mkDelegatedLsig("dynamicFeeLsig", contractName, masterAccount, scInitParam); // sign contract
	const signedContract = await deployer.getLsig("dynamicFeeLsig");
	console.log("Smart Sign ", signedContract);

	let transactions = [
		mkTxnParams(masterAccount, escrow, 1000, signedContract, { totalFee: 1000 }),
		mkTxnParams({ addr: escrow }, john.addr, 700000, contract, {
			totalFee: 1000,
			closeRemainderTo: bob.addr,
		}),
	];

	// Group Transaction FAIL - Correct transaction Fee is used BUT closeRemainderTo is set to bob
	await tryExecuteTx(deployer, transactions);

	transactions = [
		mkTxnParams(masterAccount, escrow, 1000, signedContract, { totalFee: 1000 }),
		mkTxnParams({ addr: escrow }, john.addr, 700000, contract, {
			totalFee: 1000,
			closeRemainderTo: masterAccount.addr,
		}),
	];

	// Group Transaction PASS - Correct transaction Fee is used and closeRemainderTo is set to master
	await tryExecuteTx(deployer, transactions);
}

module.exports = { default: run };
