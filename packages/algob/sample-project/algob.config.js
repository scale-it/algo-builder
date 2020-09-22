// NOTE: below we provide some example accounts.
// DON'T this account in any working environment because everyone can check it and use
// the private keys (this accounts are visible to everyone).

// NOTE: to be able to execute transactions, you need to use an active account with
// a sufficient ALGO balance.

// ## ACCOUNTS USING mnemonic ##
// const { mkAccounts } = require("algob");
// let accounts = mkAccounts([{
//   addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
//   mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
// }]);
//
// To see your algob account and extract menemonic run:
// 	goal -d $(ALGORAND_DATA) account list
// 	goal -d $(ALGORAND_DATA) account export -a <account address>


// ## ACCOUNTS loaded from a FILE ##
// const { loadAccountsFromFileSync } = require("algob");
// const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");
// accounts = accounts.concat(accFromFile);

// ## ACCOUNTS loaded from env variable ALGOB_ACCOUNTS
// keys can be stored in `ALGOB_ACCOUNTS` env variable.
// the keys in env variable should be JSON string of the following structure: 
// [{"name": "account_name", "menmonic": "mnemonic string"]} 
// process.env.ALGOB_ACCOUNTS = JSON.stringify([{"name": "master", 
//  "mnemonic": "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"}]);
// const accounts = loadFromEnv();

// ## ACCOUNTS USING Secret Key ##
let accounts = [{
  name: "owner",
  addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
  sk: new Uint8Array([28,  45,  45,  15,  70, 188,  57, 228,  18,  21,  42, 228,  33, 187, 222, 162,  89,  15,  22,  52, 143, 171, 182,  17, 168, 238,  96, 177,  12, 163, 243, 231, 160, 203, 241, 203, 176, 185,   4,  26,  16, 101, 217, 179, 83, 157, 119,  28,  82, 234, 204, 209, 249,  29,  28, 24,  97, 122, 116,  86, 135, 163, 236, 253])
}]


let defaultCfg = {
  host: "http://localhost",
  port: 8080,
  token: "content_of/algorand-node-data/algod.token",
  accounts: accounts,
};

module.exports = {
  networks: {
    localhost: defaultCfg,
    default: defaultCfg
  }
};
