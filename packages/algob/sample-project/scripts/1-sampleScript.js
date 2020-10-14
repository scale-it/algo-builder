import { ASC1Mode } from '../../src/types';

async function run(runtimeEnv, deployer) {
  console.log("Sample script for ASC has started execution!")
  if (deployer.isDeployMode) {
    await deployer.deployASC("fee-check.teal", [100], { funder: deployer.accounts[0], fundingMicroAlgo: 20000000, mode: ASC1Mode.DELEGATED_APPROVAL }, {})
  }
  console.log("Sample script for ASC execution has finished!")
}

module.exports = { default: run }
