async function tryExecuteTx(deployer, txnParams) {
	try {
		const txnParameters = Array.isArray(txnParams) ? txnParams : [txnParams];
		return await deployer.executeTx(txnParameters);
	} catch (e) {
		console.error("Transaction Failed", e.response ? e.response.error : e);
		throw e;
	}
}

module.exports = {
	tryExecuteTx,
};
