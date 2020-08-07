import type { AlgobChainCfg, AlgobConfig } from "../../../types";
import { ALGOB_CHAIN_NAME } from "../../constants";

const cfg: AlgobChainCfg = {
  accounts: [],
  chainName: ALGOB_CHAIN_NAME,
  throwOnTransactionFailures: true,
  throwOnCallFailures: true
};

const defaultConfig: AlgobConfig = {
  networks: {
    [ALGOB_CHAIN_NAME]: cfg
  },
  // analytics: {
  //  enabled: true,
  // },
  mocha: {
    timeout: 20000
  }
};

export default defaultConfig;
