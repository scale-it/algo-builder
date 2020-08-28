
async function run(runtimeEnv, accounts, deployer) {
  console.log("Sample script has started execution!")
  if (deployer.isDeployMode) {
    await deployer.deployASA("minimumASA", { creator: deployer.accounts[0] })
  }
  // deploy using feePerByte
  if (deployer.isDeployMode) {
    await deployer.deployASA("minimumASA1", {
      creator: deployer.accounts[0],
      //totalFee: 1001,
      feePerByte: 10,
      //firstValid: 10,
      validRounds: 1002
    })
  }
  if (deployer.isDeployMode) {
    await deployer.deployASA("allFieldASA", {
      creator: deployer.accounts[0],
      //totalFee: 1001,
      feePerByte: 10,
      //firstValid: 10,
      validRounds: 1002
    })
  }
  console.log("Sample script execution has finished!")
}

module.exports = { default: run }
