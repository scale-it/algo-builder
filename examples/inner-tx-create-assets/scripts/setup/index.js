const accounts = (deployer) => {
	return {
		creator: deployer.accountsByName.get("master-account"),
	};
};

module.exports = {
	accounts,
};
