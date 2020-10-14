import { ASC1Mode } from '../../../../src/types'

async function run (runtimeEnv, deployer) {
  if (deployer.isDeployMode) {
    await deployer.deployASC('fee-check.teal', {}, { funder: deployer.accounts[0], microAlgo: 100000000, mode: ASC1Mode.DELEGATED_APPROVAL }, {})
  }
}

module.exports = { default: run }
