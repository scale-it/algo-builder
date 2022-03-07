const fs = require("fs");

async function run(runtimeEnv, deployer) {
	fs.appendFileSync("output.txt", "fundLsigByFile script\n");
	await deployer.fundLsigByFile("metadata key", {}, "metadata value");
	fs.appendFileSync("output.txt", "fundLsigByFile script after\n");
}

module.exports = { default: run };
