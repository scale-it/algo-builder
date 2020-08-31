async function run(runtimeEnv, accounts, deployer) {
  console.log("Sample script for ASC has started execution!")
  if (deployer.isDeployMode) {
    await deployer.deployASC("fee-check.teal", [100], { funder: deployer.accounts[0], fundingMicroAlgo: 100000000 }, {})
  }
  console.log("Sample script for ASC execution has finished!")
}

module.exports = { default: run }
