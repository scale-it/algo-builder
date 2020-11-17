const { readGlobalStateSSC, TransactionType, SignType } = require("algob");
const { executeTransaction } = require("./common");

async function run(runtimeEnv, deployer) {

	const votingAdminAccount = deployer.accountsByName.get("voting-admin-account");
	const aliceAccount = deployer.accountsByName.get("alice-account");

	// Retreive AppInfo from checkpoints.
  	const appInfo = deployer.getSSC("permissioned-voting-approval.py", "permissioned-voting-clear.py");
	
	// Retreive Global State
	const globalState = await readGlobalStateSSC(deployer, votingAdminAccount.addr, appInfo.appID);
	console.log(globalState);

	// Count votes
	let candidatea_tally = 0, candidateb_tally = 0;
	let key;
  for (const l of globalState) {
		key = Buffer.from(l.key, 'base64').toString();
		console.log(`"${key}": ${l.value.uint}`);
    if (key === "candidatea") {
			candidatea_tally = l.value.uint;
		}
		if (key === "candidateb") {
			candidateb_tally = l.value.uint;
		}
	}
	
	// Declare Winner
	if(candidatea_tally > candidateb_tally) {
		console.log("The Winner is CandidateA!!");
	}
	else if(candidatea_tally == candidateb_tally) {
		console.log("Election Result is a tie.")
	} 
	else {
		console.log("The Winner is CandidateA!!");
	}

	let txnParam = {
		type: TransactionType.DeleteSSC,
		sign: SignType.SecretKey,
		fromAccount: votingAdminAccount,
		appId: appInfo.appID,
		payFlags: {}
	}

	// Delete Application
	console.log("Deleting Application");
	await executeTransaction(deployer, txnParam);

	txnParam.fromAccount = aliceAccount;
	txnParam.type = TransactionType.ClearSSC;

	// Clear voter's account
	console.log("Clearing Alice's Account");
	await executeTransaction(deployer, txnParam);

}

module.exports = { default: run }