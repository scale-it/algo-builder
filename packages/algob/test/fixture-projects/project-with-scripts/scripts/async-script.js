
function run (runtimeEnv, deployer) {
  return new Promise(resolve => setTimeout(resolve, 100))
}

module.exports = { default: run }
