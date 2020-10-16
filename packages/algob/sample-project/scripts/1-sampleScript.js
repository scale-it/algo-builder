async function run(runtimeEnv, deployer) {
  console.log("Sample script for ASC has started execution!")
  await deployer.fundLsig("fee-check.teal", [100], { funder: deployer.accounts[0], fundingMicroAlgo: 20000000 }, {})
  console.log("Sample script for ASC Funding execution has finished!")
}

module.exports = { default: run }
