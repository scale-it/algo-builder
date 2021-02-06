import type { Account } from "@algorand-builder/runtime/build/types";

import { AlgobRuntimeEnv, PromiseAny } from "../../src/types";

function mkAcc (name: string): Account {
  return {
    name: "acc-name-" + name,
    addr: "addr-" + name,
    sk: new Uint8Array(Buffer.from("sk-" + name, 'utf16le'))
  };
}

export function mkAlgobEnv (networkName?: string): AlgobRuntimeEnv {
  return {
    config: {
      networks: {}
    },
    runtimeArgs: {
      network: "network string",
      showStackTraces: false,
      version: false,
      help: false,
      verbose: false
    },
    tasks: {},
    run: async (_name, _args): PromiseAny => "nothing",
    network: {
      name: networkName === undefined ? "network1" : networkName,
      config: {
        accounts: [
          mkAcc("1"),
          mkAcc("2"),
          mkAcc("3")
        ],
        host: "network host",
        port: 1,
        token: "network token"
      }
    }
  };
}
