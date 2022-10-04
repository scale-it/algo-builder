exports.tryExecuteTx = async function (deployer, txnParams) {
	try {
		if (Array.isArray(txnParams)) await deployer.executeTx(txnParams);
		else await deployer.executeTx([txnParams]);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
		throw e;
	}
};
