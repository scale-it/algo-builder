/* eslint-disable max-len */

// import { mkAccounts } from "algob";
// let accounts = mkAccounts([{
//   addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
//   mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
// }]);

const accounts = [{
  addr: 'KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY',
  sk: new Uint8Array([3, 169, 134, 121, 53, 133, 5, 224, 60, 164, 154, 221, 134, 50, 59, 233, 234, 228, 20, 217, 47, 234, 40, 26, 33, 55, 90, 26, 66, 141, 7, 85, 81, 88, 241, 118, 22, 102, 228, 46, 242, 255, 165, 169, 111, 58, 67, 114, 39, 179, 239, 0, 237, 28, 42, 0, 154, 0, 73, 27, 226, 74, 204, 187])
}]

task('example2', 'example task', async (_ret) => 28)
task('example', 'example task', async (__, { run }) => run('example2'))

module.exports = {
  networks: {
    custom: {
      host: 'http://localhost',
      port: 8081,
      token: 'somefaketoken',
      accounts: accounts
    },
    localhost: {
      host: 'http://127.0.0.1',
      port: 8080,
      token: 'somefaketoken',
      accounts: accounts
    }
  },
  unknown: { asd: 123 }
}
