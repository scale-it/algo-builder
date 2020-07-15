// This module provides algorand SDK driver

import algosdk from "algosdk";

import { ALGOB_CHAIN_NAME } from "../internal/constants";
import type { HttpNetworkConfig, Network } from "../types";

// @note: probably in the future we will remove this function and provide our own wrapper
export function createClient (n: Network): algosdk.Algodv2 {
  if (n.name !== ALGOB_CHAIN_NAME) {
    const cfg = n.config as HttpNetworkConfig;
    return new algosdk.Algodv2(cfg.token, cfg.host, cfg.port);
  }
  throw Error("Initializing SDK driver for AlgobChain is not supported yet");
}
