async function run(runtimeEnv, deployer) {
  console.log("Sample script for ASC has started execution!")
  if (deployer.isDeployMode) {
    await deployer.deployASC("fee-check.teal", [100], { funder: deployer.accounts[0], fundingMicroAlgo: 20000000, mode: "Delegated Approval" }, {})
  }
  console.log("Sample script for ASC execution has finished!")
}

module.exports = { default: run }
