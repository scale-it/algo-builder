import { BuilderConfig, BuilderNetworkConfig } from "../../../types";
import { BUILDEREVM_NETWORK_NAME } from "../../constants";

export const DEFAULT_SOLC_VERSION = "0.5.15";
export const BUILDEREVM_DEFAULT_GAS_PRICE = 8e9;

const DEFAULT_BUILDER_NETWORK_CONFIG: BuilderNetworkConfig = {
  accounts: [],
};

const defaultConfig: BuilderConfig = {
  defaultNetwork: BUILDEREVM_NETWORK_NAME,
  //solc: {
  //  version: DEFAULT_SOLC_VERSION,
  //  optimizer: {
  //    enabled: false,
  //    runs: 200,
  //  },
  //},
  networks: {
    [BUILDEREVM_NETWORK_NAME]: DEFAULT_BUILDER_NETWORK_CONFIG,
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  analytics: {
    enabled: true,
  },
  mocha: {
    timeout: 20000,
  },
};

export default defaultConfig;
