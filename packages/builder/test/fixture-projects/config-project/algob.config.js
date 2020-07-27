import { mkAccounts } from "algob";

let accounts = mkAccounts([{
  addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
  mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
}]);


task('example2', 'example task', async (_ret) => 28)

task('example', 'example task', async (__, { run }) => run('example2'))

module.exports = {
  networks: {
    custom: {
      host: 'http://localhost',
      port: 8081,
      token: 'somefaketoken'
    },
    localhost: {
      host: 'http://127.0.0.1',
      port: 8080,
      token: 'somefaketoken',
      accounts: accounts
    },
  },
  unknown: { asd: 123 }
}
