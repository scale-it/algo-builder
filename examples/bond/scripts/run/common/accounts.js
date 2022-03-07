/**
 * This function loads accounts from deployer
 * @param deployer deployer object
 */
exports.accounts = async function (deployer) {
	return {
		master: await deployer.accountsByName.get("master-account"),
		creator: await deployer.accountsByName.get("john"),
		bob: await deployer.accountsByName.get("bob"),
		elon: await deployer.accountsByName.get("elon-musk"),
		manager: await deployer.accountsByName.get("alice"),
	};
};
