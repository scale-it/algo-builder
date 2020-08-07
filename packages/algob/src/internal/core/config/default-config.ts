import type { AlgobChainCfg, AlgobConfig// , HttpNetworkConfig
} from "../../../types";
import { ALGOB_CHAIN_NAME } from "../../constants";

// const DEFAULT_NETWORK_CONFIG: HttpNetworkConfig = {
//   accounts: [],
//   chainName: "devnet",
//   host: "http://localhost",
//   port: 8080,
//   token: ""
// }

const cfg: AlgobChainCfg = {
  accounts: [],
  chainName: ALGOB_CHAIN_NAME,
  throwOnTransactionFailures: true,
  throwOnCallFailures: true
};

const defaultConfig: AlgobConfig = {
  networks: {
    [ALGOB_CHAIN_NAME]: cfg
    // default: DEFAULT_NETWORK_CONFIG
  },
  // analytics: {
  //  enabled: true,
  // },
  mocha: {
    timeout: 20000
  }
};

export default defaultConfig;
