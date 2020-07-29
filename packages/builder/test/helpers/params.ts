import { AlgobRuntimeEnv, PromiseAny } from "../../src/types";

export function mkAlgobEnv(networkName?: string): AlgobRuntimeEnv {
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
    run: async (name, args): PromiseAny => "nothing",
    network: {
      name: networkName || "network name",
      config: {
        host: "network host",
        port: 1,
        token: "network token"
      }
    }
  }
}
