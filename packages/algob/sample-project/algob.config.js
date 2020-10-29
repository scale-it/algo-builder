// NOTE: below we provide some example accounts.
// DON'T this account in any working environment because everyone can check it and use
// the private keys (this accounts are visible to everyone).

// NOTE: to be able to execute transactions, you need to use an active account with
// a sufficient ALGO balance.

/**
  Check our /docs/algob-config.md documentation for more ways how to
  load a private keys:
  + using mnemonic
  + using binary secret key
  + using KMD daemon
  + loading from a file
  + loading from an environment variable
  + ...
*/

// ## ACCOUNTS USING mnemonic ##
const { mkAccounts } = require("algob");
let accounts = mkAccounts([{
  name: "master",
  addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
  mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
}]);


// ## ACCOUNTS loaded from a FILE ##
// const { loadAccountsFromFileSync } = require("algob");
// const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");
// accounts = accounts.concat(accFromFile);


let defaultCfg = {
  host: "http://localhost",
  port: 8080,
  token: "content_of/algorand-node-data/algod.token",
  accounts: accounts,
  // if you want to load accounts from KMD, you need to add the kmdCfg object. Please read
  // algob-config.md documentation for details.
  // kmdCfg: kmdCfg,
};

module.exports = {
  networks: {
    localhost: defaultCfg,
    default: defaultCfg
  }
};
