const { accounts } = require("./common/accounts.js");
const { fundAccount, getAssetID, tokenMap } = require("./common/common.js");
const { createBuyback } = require("./createBuyback.js");
const { createDex } = require("./createDex.js");
const { epoch0 } = require("./epoch0.js");
const { epoch1 } = require("./epoch1.js");
const { exitBuyer } = require("./exit.js");
const { issue } = require("./issue.js");
const { redeem } = require("./redeem.js");

/**
 * In a run script example we present the following scenario:
 *  - Issue initial bond tokens to the issuer
 *  - In epoch_0 elon buys 10 bonds
 *  - In epoch 0 elon sells 2 bonds to bob for 2020 ALGO (in a group transaction)
 *  - Manager creates dex 1
 *  - Elon redeems his bonds (8), Elon buys 4 more bonds (so he will have 12 bonds in total)
 *  - Manager creates dex 2
 *  - Elon redeems all his bonds.
 *  - Bob redeems his bonds from epoch 0 and 1
 *  - Maturity period is set to 240 seconds(4 min) after the contract deployment.
 *    At maturity, manager creates and funds buyback and both elon and bob
 *    can exit all their tokens (12 and 2 respectively).
 * @param runtimeEnv
 * @param deployer
 */
async function run(runtimeEnv, deployer) {
	const oldBond = await getAssetID("bond-token-0", deployer);
	tokenMap.set("bond-token-0", oldBond);
	// fund buyers
	const account = await accounts(deployer);
	await fundAccount(deployer, account.bob.addr);
	await fundAccount(deployer, account.elon.addr);

	// Issue tokens to issuer
	await issue(deployer);

	// elon buys 10 bond tokens and sell 2 bond tokens to bob for 2020 Algos
	await epoch0(deployer);

	// Create DEX, burn B_0, issue B_1
	await createDex(deployer, account.creator, account.manager, 1);

	// Elon redeems 8 bond tokens and buys 4 more from new dex
	await epoch1(deployer);

	// Create DEX, burn B_1, issue B_2
	await createDex(deployer, account.creator, account.manager, 2);

	// Redeem all 12 bonds from elon from dex 2
	await redeem(deployer, account.elon, account.manager, 2, 12);

	// Redeem bob's bonds from dex 1
	await redeem(deployer, account.bob, account.manager, 1, 2);
	// Redeem bob's bonds from dex 2
	await redeem(deployer, account.bob, account.manager, 2, 2);

	// create buyback
	await createBuyback(deployer, account.manager, 2);

	// exit buyer from bond, buyer can exit only if maturity period is over
	// currently set to 240 seconds
	setTimeout(async () => {
		await exitBuyer(deployer, account.manager, account.elon, 2, 12);
		await exitBuyer(deployer, account.manager, account.bob, 2, 2);
	}, 240000);
}

module.exports = { default: run };
