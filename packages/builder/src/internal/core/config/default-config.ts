import { AlgobConfig, HttpNetworkConfig } from "../../../types";
import { ALGOB_CHAIN_NAME } from "../../constants";

const DEFAULT_NETWORK_CONFIG: HttpNetworkConfig = {
  // accounts: [],
  chainName: "devnet",
  url: "https://localhost:8080"
};

const defaultConfig: AlgobConfig = {
  networks: {
    default: DEFAULT_NETWORK_CONFIG,
    [ALGOB_CHAIN_NAME]: {
      chainName: ALGOB_CHAIN_NAME,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true
    }
  },
  //analytics: {
  //  enabled: true,
  //},
  mocha: {
    timeout: 20000,
  },
};

export default defaultConfig;
