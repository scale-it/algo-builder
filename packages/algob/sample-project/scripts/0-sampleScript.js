
function run(runtimeEnv, accounts, deployer) {
  console.log("Sample script has been executed!")
  if (deployer.isWritable) {
    deployer.deployASA("minimumASA", {}, deployer.accounts[0])
  }
}

module.exports = { default: run }
