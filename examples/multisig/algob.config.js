// NOTICE: This config provides sample accounts.
// DON'T use these accounts in any public environment because everyone can see and use them.
// The private keys of these accounts are visible to everyone.
// This means that they can spend the funds and assets.

const { mkAccounts } = require("algob");
let accounts = mkAccounts([
  {
    name: "master-account",
    // This account is exported from algorand node.
    // It must already exist or ALGO tokens have to be transferred from elsewhere.
    // It contains a lot of ALGO tokens so it can fund other accounts.
    // You should view your accounts and replace this with your own account.
    // Command to view account addresses (and their balances):
    // goal account list -d ~/.algorand-local/Node/
    addr: "WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE",
    // To export private mnemonic you may use this command (with you own account's address and data directory):
    // goal account export -a WWYNX3TKQYVEREVSW6QQP3SXSFOCE3SKUSEIVJ7YAGUPEACNI5UGI4DZCE -d ~/.algorand-local/Node/
    mnemonic: "enforce drive foster uniform cradle tired win arrow wasp melt cattle chronic sport dinosaur announce shell correct shed amused dismiss mother jazz task above hospital"
  },
  // Following accounts are generated using `algob gen-accounts`.
  // Do not use these exact accounts in your own applications.
  // See notice at the top of this file.
  {
    name: "gold-owner-account",
    addr: "M7VR2MGHI35EG2NMYOF3X337636PIOFVSP2HNIFUKAG7WW6BDWDCA3E2DA",
    mnemonic: "quick stage planet wild coffee whale build brisk forest leave same segment armed alter fog know run distance excess galaxy limb talent nut able noodle"
  },
  {
    name: "john-account",
    addr: "2UBZKFR6RCZL7R24ZG327VKPTPJUPFM6WTG7PJG2ZJLU234F5RGXFLTAKA",
    mnemonic: "found empower message suit siege arrive dad reform museum cake evoke broom comfort fluid flower wheat gasp baby auction tuna sick case camera about flip"
  },
  {
    name: "bob-account",
    addr: "2ILRL5YU3FZ4JDQZQVXEZUYKEWF7IEIGRRCPCMI36VKSGDMAS6FHSBXZDQ",
    mnemonic: "caution fuel omit buzz six unique method kiwi twist afraid monitor song leader mask bachelor siege what shiver fringe else mass hero deposit absorb tooth"
  }
]);

let defaultCfg = {
  host: "http://localhost",
  port: 46469,
  token: "aade468d25a7aa48fec8082d6a847c48492066a2741f3731e613fdde086cd6e9",
  accounts: accounts,
};

module.exports = {
  networks: {
    localhost: defaultCfg,
    default: defaultCfg
  }
};
