const accounts = (deployer) => {
	return {
		creator: deployer.accountsByName.get("master-account"),
	};
};

const decodeValue = (value) => {
	return new TextDecoder().decode(value);
};

module.exports = {
	accounts,
	decodeValue,
};
