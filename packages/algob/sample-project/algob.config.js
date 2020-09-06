// NOTE: below we provide some example accounts.
// DON'T this account in any working environment because everyone can check it and use
// the private keys (this accounts are visible to everyone).

// Example: accounts constructed using mnemonic. `addr` is optional.
// const { mkAccounts } = require("algob");
// let accounts = mkAccounts([{
//   addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
//   mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
// }]);
const { loadKMDAddresses } = require("algob/src/lib/account");

// Example: accounts constructed using the Account object
let accounts = [{
  name: "owner",
  addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
  sk: new Uint8Array([28,  45,  45,  15,  70, 188,  57, 228,  18,  21,  42, 228,  33, 187, 222, 162,  89,  15,  22,  52, 143, 171, 182,  17, 168, 238,  96, 177,  12, 163, 243, 231, 160, 203, 241, 203, 176, 185,   4,  26,  16, 101, 217, 179, 83, 157, 119,  28,  82, 234, 204, 209, 249,  29,  28, 24,  97, 122, 116,  86, 135, 163, 236, 253])
}]

// KMD credentials
let KMDConfig = {
  host: "127.0.0.1",
  port: 123,
  token: "sfsd"
}

let wallet = {
  name: "WALLET1",
  password: "pass"
}

// load KMD Accounts from given wallet - (addr, secret key)
let kmdAddresses = loadKMDAddresses(KMDConfig.host, KMDConfig.token, KMDConfig.port, 
  wallet.name, wallet.password);

console.log(kmdAddresses);

// const { loadAccountsFromFileSync } = require("algob");
// // Example: accounts loaded from a file:
// const accFromFile = loadAccountsFromFileSync("assets/accounts_generated.yaml");
// accounts = accounts.concat(accFromFile);

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
