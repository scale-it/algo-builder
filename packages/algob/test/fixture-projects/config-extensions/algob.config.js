import { extendConfig } from '../../../src/internal/core/config/config-env'

extendConfig((config, _userConfig) => {
  config.values = [1]
})

extendConfig((config, _userConfig) => {
  config.values.push(2)
})

module.exports = {}
