const APP_NAME = "FundApp";

const accounts = (deployer) => {
	return {
		creator: deployer.accountsByName.get("master-account"),
	};
};

module.exports = {
	APP_NAME,
	accounts,
};
