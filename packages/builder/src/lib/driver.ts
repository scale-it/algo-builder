// This module provides algorand SDK driver

// TODO: import doesn't work: https://www.pivotaltracker.com/story/show/173671803
// import algosdk from "algosdk";
const algosdk = require("algosdk");  // eslint-disable-line @typescript-eslint/no-var-requires

import { ALGOB_CHAIN_NAME } from "../internal/constants";
import type { HttpNetworkConfig, Network } from "../types";

// @note: probably in the future we will remove this function and provide our own wrapper
export function createClient(n: Network): Algodv2 {
  if (n.name !== ALGOB_CHAIN_NAME) {
    const cfg = n.config as HttpNetworkConfig;
    return new algosdk.Algodv2(cfg.token, cfg.host, cfg.port);
  }
  throw Error("Initializing SDK driver for AlgobChain is not supported yet");
}

// ****  TYPES  ****

interface Action<T> {
  do(headers?: Record<string, unknown>): Promise<T>;
}

export interface Algodv2 {
  status(): Action<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
