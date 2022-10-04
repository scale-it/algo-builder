const { mkTxnParams, tryExecuteTx } = require("./common/common");
const { globalZeroAddress, convert } = require("@algo-builder/algob");
const { types } = require("@algo-builder/web");

async function run(runtimeEnv, deployer) {
	const masterAccount = deployer.accountsByName.get("master-account");
	const john = deployer.accountsByName.get("john");

	// let's make sure john account is active and it has enough balance
	const txnParams = mkTxnParams(masterAccount, john.addr, 4e6, {}, { note: "funding account" });
	await tryExecuteTx(deployer, {
		...txnParams,
		sign: types.SignType.SecretKey,
		fromAccount: masterAccount,
	});

	const secret = "hero wisdom green split loop element vote belt";
	const wrongSecret = "hero wisdom red split loop element vote belt";

	// setup a contract account and send 1 ALGO from master
	await deployer
		.fundLsigByFile(
			"htlc.py",
			{
				funder: masterAccount,
				fundingMicroAlgo: 1e6, // 1 Algo
			},
			{ closeRemainderTo: john.addr }
		)
		.catch((error) => {
			throw error;
		});

	await deployer.addCheckpointKV("User Checkpoint", "Fund Contract Account");

	const contract = await deployer.loadLogicByFile("htlc.py");
	const contractAddress = contract.address();

	txnParams.fromAccountAddr = contractAddress;
	txnParams.sign = types.SignType.LogicSignature;
	txnParams.args = [convert.stringToBytes(wrongSecret)];
	txnParams.toAccountAddr = globalZeroAddress;
	txnParams.amountMicroAlgos = 0;
	txnParams.lsig = contract;
	txnParams.payFlags = { totalFee: 1000, closeRemainderTo: john.addr };

	// Fails because wrong secret is provided
	await tryExecuteTx(deployer, txnParams).catch((error) => {
		console.log(error);
	});

	// Passes because right secret is provided
	txnParams.args = [convert.stringToBytes(secret)];
	await tryExecuteTx(deployer, txnParams);
}

module.exports = { default: run };
