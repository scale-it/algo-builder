const { readGlobalStateSSC } = require("algob");

async function run(runtimeEnv, deployer) {

	const votingAdminAccount = deployer.accountsByName.get("voting-admin-account");

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

}

module.exports = { default: run }