// import { mkAccounts } from "algob";
// let accounts = mkAccounts([{
//   addr: "KFMPC5QWM3SC54X7UWUW6OSDOIT3H3YA5UOCUAE2ABERXYSKZS5Q3X5IZY",
//   mnemonic: "call boy rubber fashion arch day capable one sweet skate outside purse six early learn tuition eagle love breeze pizza loud today popular able divide"
// }]);

let accounts = [{
  addr: 'UDF7DS5QXECBUEDF3GZVHHLXDRJOVTGR7EORYGDBPJ2FNB5D5T636QMWZY',
  sk: new Uint8Array([28,  45,  45,  15,  70, 188,  57, 228,  18,  21,  42, 228,  33, 187, 222, 162,  89,  15,  22,  52, 143, 171, 182,  17, 168, 238,  96, 177,  12, 163, 243, 231, 160, 203, 241, 203, 176, 185,   4,  26,  16, 101, 217, 179, 83, 157, 119,  28,  82, 234, 204, 209, 249,  29,  28, 24,  97, 122, 116,  86, 135, 163, 236, 253])
}]


task('example2', 'example task', async (_ret) => 28)
task('example', 'example task', async (__, { run }) => run('example2'))

module.exports = {
  networks: {
    custom: {
      host: 'http://localhost',
      port: 8081,
      token: 'somefaketoken'
      accounts: accounts
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
