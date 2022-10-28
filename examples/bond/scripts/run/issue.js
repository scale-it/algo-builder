const { issueTx, tryExecuteTx } = require("./common/common");
/**
 * In this function tokens are issued to issuer from token creator.
 * @param deployer deployer
 */
exports.issue = async function (deployer) {
	const creatorAccount = deployer.accountsByName.get("john");
	const appInfo = deployer.getApp("BondApp");
	const issuerLsig = deployer.getLsig("IssuerLsig");
	const asaInfo = deployer.getASAInfo("bond-token-0");
	const groupTx = issueTx(creatorAccount, issuerLsig, appInfo.appID, asaInfo.assetIndex);

	console.log("Issuing tokens!");
	await tryExecuteTx(deployer, groupTx);
	console.log("Tokens issued to issuer");
};
