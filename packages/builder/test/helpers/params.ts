import { AlgobRuntimeEnv, PromiseAny } from "../../src/types";

export function mkAlgobEnv(): AlgobRuntimeEnv {
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
      name: "network name",
      config: {
        host: "network host",
        port: 1,
        token: "network token"
      }
    }
  }
}
