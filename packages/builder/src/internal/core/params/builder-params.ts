import { AlgobParamDefinitions, AlgobShortParamSubstitutions, ParamDefinition } from "../../../types";
import * as types from "./argument-types";

export const ALGOB_PARAM_DEFINITIONS: AlgobParamDefinitions = {
  network: {
    name: "network",
    defaultValue: "default",
    description: "The network to connect to.",
    type: types.string,
    isOptional: true,
    isFlag: false,
    isVariadic: false,
  },
  showStackTraces: {
    name: "showStackTraces",
    defaultValue: false,
    description: "Show stack traces.",
    type: types.boolean,
    isFlag: true,
    isOptional: true,
    isVariadic: false,
  },
  version: {
    name: "version",
    defaultValue: false,
    description: "Shows version and exit.",
    type: types.boolean,
    isFlag: true,
    isOptional: true,
    isVariadic: false,
  },
  help: {
    name: "help",
    shortName: "h",
    defaultValue: false,
    description: "Shows this message, or a task's help if its name is provided",
    type: types.boolean,
    isFlag: true,
    isOptional: true,
    isVariadic: false,
  },
  config: {
    name: "config",
    defaultValue: undefined,
    description: "Path to algob config file.",
    type: types.inputFile,
    isFlag: false,
    isOptional: true,
    isVariadic: false,
  },
  verbose: {
    name: "verbose",
    defaultValue: false,
    description: "Enables verbose logging",
    type: types.boolean,
    isFlag: true,
    isOptional: true,
    isVariadic: false,
  }
};

// reverse lookup map for short parameters
export const ALGOB_SHORT_PARAM_SUBSTITUTIONS: AlgobShortParamSubstitutions =
  Object.entries(ALGOB_PARAM_DEFINITIONS)
    .reduce((out: Record<string, string>, kv: [string, ParamDefinition<unknown>]) => {
      const [name, value] = kv;
      if (value.shortName) {
        out[value.shortName] = name;
      }
      return out
    }, {});
