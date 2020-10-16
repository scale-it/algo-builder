
async function run(runtimeEnv, deployer) {
  console.log("Sample script has started execution!")
  await deployer.deployASA("minimumASA", { creator: deployer.accounts[0] })
  // deploy using feePerByte
  await deployer.deployASA("minimumASA1", {
    creator: deployer.accounts[0],
    //totalFee: 10001,
    feePerByte: 10,
    //firstValid: 2,
    validRounds: 1002
  })

  await deployer.deployASA("allFieldASA", {
    creator: deployer.accounts[0],
    //totalFee: 10001,
    feePerByte: 10,
    //firstValid: 2,
    validRounds: 1002
  })
  console.log("Sample script execution has finished!")
}

module.exports = { default: run }
