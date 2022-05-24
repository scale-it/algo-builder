/**
 * This function loads accounts from deployer
 * @param deployer deployer object
 */
function accounts(deployer) {
	return {
		creator: deployer.accountsByName.get("john"),
		proposer: deployer.accountsByName.get("bob"),
		voterA: deployer.accountsByName.get("elon-musk"),
		voterB: deployer.accountsByName.get("alice"),
	};
}

module.exports = {
	accounts,
};
