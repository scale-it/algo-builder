import { mkAccounts } from "algob";

let accounts = mkAccounts([{
  addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
  mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
}]);

let defaultCfg = {
  host: "http://localhost",
  port: 8080,
  token: "$ALGORAND_DATA/algod.token",
  accounts: accounts,
};

module.exports = {
  networks: {
    localhost: defaultCfg,
    default: defaultCfg
  }
};
