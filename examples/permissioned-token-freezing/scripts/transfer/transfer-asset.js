const { types } = require("@algo-builder/web");
const { tryExecuteTx } = require("../common/common");

async function run(runtimeEnv, deployer) {
	const creator = deployer.accountsByName.get("alice");
	const bob = deployer.accountsByName.get("bob");

	// NOTE: set min asset level first using ./set-clear-level.js
	const appInfo = deployer.getApp("PermissionedTokenApp");
	const assetInfo = deployer.asa.get("gold");

	const escrowLsig = deployer.getLsig("clawbackEscrow");
	const escrowAddress = escrowLsig.address();

	const txGroup = [
		/**
		 * tx 0 - Call to stateful smart contract with application arg: 'check-level'
		 * The contract ensures that alice and bob have a minimum level (accred-level) set
		 * and only then the tx will be approved. The smart contract also checks each transaction
		 * params in the txGroup (eg. sender(tx1) === receiver(tx2) === escrowAddress)
		 */
		{
			type: types.TransactionType.CallApp,
			sign: types.SignType.SecretKey,
			fromAccount: creator,
			appID: appInfo.appID,
			payFlags: { totalFee: 1000 },
			appArgs: ["str:check-level"],
			accounts: [bob.addr], //  AppAccounts
		},
		/**
		 * tx 1 - Asset transfer transaction from Alice -> Bob. This tx is executed
		 * and approved by the escrow account (clawback-escrow.teal). The escrow account address is
		 * also the clawback address which transfers the frozen asset (amount = 1000) from Alice to Bob
		 */
		{
			type: types.TransactionType.RevokeAsset,
			sign: types.SignType.LogicSignature,
			fromAccountAddr: escrowAddress,
			recipient: bob.addr,
			assetID: assetInfo.assetIndex,
			revocationTarget: creator.addr,
			amount: 1000,
			lsig: escrowLsig,
			payFlags: { totalFee: 1000 },
		},
		/**
		 * tx 2 - Payment transaction of 1000 from creator(Alice) to escrow Account. This tx is used to
		 * cover the fee of tx1.
		 */
		{
			type: types.TransactionType.TransferAlgo,
			sign: types.SignType.SecretKey,
			fromAccount: creator,
			toAccountAddr: escrowAddress,
			amountMicroAlgos: 1000,
			payFlags: { totalFee: 1000 },
		},
	];

	console.log("* Transferring 1000 Assets from Alice to Bob *");

	await tryExecuteTx(deployer, txGroup);
}

module.exports = { default: run };
