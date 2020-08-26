
async function run(runtimeEnv, accounts, deployer) {
  console.log("Sample script has been executed!")
  if (deployer.isWriteable) {
    await deployer.deployASA("minimumASA", { creator: deployer.accounts[0] })
  }
  // deploy using feePerByte
  if (deployer.isWriteable) {
    await deployer.deployASA("minimumASA1", {
      creator: deployer.accounts[0],
      //totalFee: 1001,
      feePerByte: 10,
      //firstValid: 10,
      validRounds: 1002
    })
  }
}

module.exports = { default: run }
