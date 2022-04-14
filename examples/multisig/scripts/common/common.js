const { executeTx } = require("@algo-builder/algob");

exports.executeTx = async function (deployer, txnParams) {
	try {
		if (Array.isArray(txnParams)) await executeTx(deployer, txnParams);
		else await executeTx(deployer, [txnParams]);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
	}
};
