// NOTE: below we provide some example accounts.
// DON'T this account in any working environment because everyone can check it and use
// the private keys (this accounts are visible to everyone).

// NOTE: to be able to execute transactions, you need to use an active account with
// a sufficient ALGO balance.

/**
	 Check our /docs/algob-config.md documentation (https://algobuilder.dev/guide/algob-config.html) for more configuration options and ways how to
	load a private keys:
	+ using mnemonic
	+ using binary secret key
	+ using KMD daemon
	+ loading from a file
	+ loading from an environment variable
	+ ...
*/

// ## ACCOUNTS USING mnemonic ##
const { mkAccounts, algodCredentialsFromEnv } = require("@algo-builder/algob");
let accounts = mkAccounts([
	{
		// This account is created using `make setup-master-account` command from our
		// `/infrastructure` directory. It already has many ALGOs
		name: "master",
		addr: "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
		mnemonic:
			"enforce drive foster uniform cradle tired win arrow wasp melt cattle chronic sport dinosaur announce shell correct shed amused dismiss mother jazz task above hospital",
	},
]);

// ## ACCOUNTS loaded from a FILE ##
// const { loadAccountsFromFileSync } = require("@algo-builder/algob");
// const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");
// accounts = accounts.concat(accFromFile);

/// ## Load accounts from KMD ##
/// Please check https://github.com/scale-it/algo-builder/blob/master/docs/guide/algob-config.md#network-credentials for more details and more methods.
//   let kmdCred = KMDCredentialsFromEnv();

let defaultCfg = {
	host: "http://localhost",
	port: 4001,
	/// Below is a token created through our script in `/infrastructure`
	/// If you use other setup, update it accordignly (eg content of algorand-node-data/algod.token)
	token: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	/// you can also pass token as an object:
	// token: {
	//   "X-Algo-API-Token": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	// },
	accounts: accounts,
	/// if you want to load accounts from KMD, you need to add the kmdCfg object. Please read
	/// Algob Config documentation for details.
	// kmdCfg: {wallets: [{name: "mywallet", password: process.env.KMD_PASSWD, accounts: [...]}], ...kmdCred},

	/// you can pass config of indexer (ideally it should be attached to this network's algod node)
	// indexerCfg: {
	// 	host: "http:localhost",
	// 	port: 8980,
	// 	token: ""
	// }
};

// purestake testnet config
let purestakeTestNetCfg = {
	host: "https://testnet-algorand.api.purestake.io/ps2",
	port: "",
	token: {
		"X-API-Key": "Xhkn7v7h972hj7Egx3fGr9RFbfXeGuoD6wSLKDyG",
	},
};

// You can also use Environment variables to get Algod credentials
// Please check https://algobuilder.dev/guide/algob-config.html#network-credentials for more details.
process.env.ALGOD_ADDR = "127.0.0.1:4001";
process.env.ALGOD_TOKEN = "algod_token";
let algodCred = algodCredentialsFromEnv();
let envCfg = {
	...algodCred,
	accounts: accounts,
};

module.exports = {
	networks: {
		default: defaultCfg,
		prod: envCfg,
		purestake: purestakeTestNetCfg,
	},
};
