const crypto = require("crypto");

const { balanceOf } = require("@algo-builder/algob");
const { mkParam } = require("./transfer/common");
/*
	Create "gold" Algorand Standard Asset (ASA).
	Accounts are loaded from config.
	To use ASA, accounts have to opt-in. Owner is opt-in by default.
*/

async function run(runtimeEnv, deployer) {
	console.log("[gold]: Script has started execution!");

	// we start with extracting acocunt objects from the config.
	const masterAccount = deployer.accountsByName.get("master-account");
	const goldOwner = deployer.accountsByName.get("alice");
	const john = deployer.accountsByName.get("john");
	const bob = deployer.accountsByName.get("bob");

	// Accounts can only be active if they poses minimum amont of ALGOs.
	// Here we fund the accounts with 5e6, 5e6 and 1e6 micro AlGOs.
	const message = "funding account";
	// or encode the text manually if you use SDK transactions directly:
	// let note = new TextEncoder().encode(message); // note must be Uint8Array

	const promises = [
		deployer.executeTx(mkParam(masterAccount, goldOwner.addr, 5e6, { note: message })),
		deployer.executeTx(mkParam(masterAccount, john.addr, 5e6, { note: message })),
		deployer.executeTx(mkParam(masterAccount, bob.addr, 1e6, { note: message })),
	];
	await Promise.all(promises);

	// create an assetMetadataHash as Uint8Array
	const metadataHash = new Uint8Array(
		crypto.createHash("sha256").update("some content").digest()
	);
	// or UTF-8 string:
	// let metadataHash = "this must be 32 chars long text."
	// or from hex:
	// let metadataHash = Buffer.from(
	//     '664143504f346e52674f35356a316e64414b3357365367633441506b63794668', 'hex')

	// Let's deploy ASA. The following commnad will open the `assets/asa.yaml` file and search for
	// the `gold` ASA. The transaction can specify standard transaction parameters. If skipped
	// node suggested values will be used.
	const asaInfo = await deployer.deployASA(
		"gold",
		{
			creator: goldOwner,
			// totalFee: 1001,
			// feePerByte: 100,
			// firstValid: 10,
			// validRounds: 1002
		},
		{
			metadataHash,
			reserve: bob.addr, // override default value set in asa.yaml
			// freeze: bob.addr
			// note: "gold-asa"
		}
	);
	console.log(asaInfo);

	// In asa.yaml we only added `john` to opt-in accounts. Let's add `bob` as well using the
	// script;
	await deployer.optInAccountToASA("gold", "bob", {});

	// to interact with an asset we need asset ID. We can get it from the returned object:
	const assetID = asaInfo.assetIndex;

	// we can inspect the balance of the goldOnwer. It should equal to the `total` value defined
	// in the asa.yaml.
	console.log("Balance: ", await balanceOf(deployer, goldOwner.addr, assetID));

	console.log("[gold]: Script execution has finished!");
}

module.exports = { default: run };
