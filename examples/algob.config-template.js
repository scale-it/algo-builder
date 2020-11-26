// NOTICE: This config provides sample accounts.
// DON'T use these accounts in any public environment because everyone can see and use them.
// The private keys of these accounts are visible to everyone.
// This means that they can spend the funds and assets.

/**
   Check our /docs/algob-config.md documentation for more ways how to
   load a private keys.
*/

const { mkAccounts } = require("algob");
let accounts = mkAccounts([
  {
    name: "master-account",
    // This account is exported from algorand an node.
    // It must already exist or ALGO tokens have to be transferred from elsewhere.
    // It contains a lot of ALGO tokens so it can fund other accounts.
    // You should check your accounts and replace this with your own account.
    // Command to view KMD account addresses (and their balances):
    // goal account list -d ~/.algorand-local/Node/
    addr: "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
    // To export private mnemonic you may use this command (with you own account's address and data directory):
    // goal account export -a WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE -d ~/.algorand-local/Node/
    mnemonic: "enforce drive foster uniform cradle tired win arrow wasp melt cattle chronic sport dinosaur announce shell correct shed amused dismiss mother jazz task above hospital"
  },
  // Following accounts are generated using `algob gen-accounts`.
  {
    name: "elon-musk",
    addr: "WHVQXVVCQAD7WX3HHFKNVUL3MOANX3BYXXMEEJEJWOZNRXJNTN7LTNPSTY",
    mnemonic: "resist derive table space jealous person pink ankle hint venture manual spawn move harbor flip cigar copy throw swap night series hybrid chest absent art"
  }, {
    name: "john",
    addr: "2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA",
    mnemonic: "found empower message suit siege arrive dad reform museum cake evoke broom comfort fluid flower wheat gasp baby auction tuna sick case camera about flip"
  }, {
    name: "alice",
    addr: "EDXG4GGBEHFLNX6A7FGT3F6Z3TQGIU6WVVJNOXGYLVNTLWDOCEJJ35LWJY",
    mnemonic: "brand globe reason guess allow wear roof leisure season coin own pen duck worth virus silk jazz pitch behave jazz leisure pave unveil absorb kick"
  }, {
    name: "bob",
    addr: "2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ",
    mnemonic: "caution fuel omit buzz six unique method kiwi twist afraid monitor song leader mask bachelor siege what shiver fringe else mass hero deposit absorb tooth"
  }
]);


let defaultCfg = {
  host: "http://localhost",
  // if you are running a local node, you can find port and token values for your algod in
  // $ALGORAND_DATA/algod.net and $ALGORAND_DATA/algod.token files.
  port: 8080,
  token: "aade468d25a7aa48fec8082d6a847c48492066a2741f3731e613fdde086cd6e9",
  // you can also load accounts from KMD, look at /docs/algob-config.md for more details.
  accounts: accounts
};

module.exports = {
  networks: {
    default: defaultCfg
  }
};
