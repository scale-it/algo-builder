export const ERROR_PREFIX = "ABLDR";

export interface ErrorDescriptor {
  number: number
  // Message can use templates. See applyErrorMessageTemplate
  message: string
  // Title and description can be Markdown
  title: string
  description: string
}

export function getErrorCode (error: ErrorDescriptor): string {
  return `${ERROR_PREFIX}${error.number}`;
}

export const ERROR_RANGES = {
  GENERAL: { min: 0, max: 99, title: "General errors" },
  NETWORK: { min: 100, max: 199, title: "Network related errors" },
  TASK_DEFINITIONS: {
    min: 200,
    max: 299,
    title: "Task definition errors"
  },
  ARGUMENTS: { min: 300, max: 399, title: "Arguments related errors" },
  ACCOUNT: { min: 400, max: 409, title: "Account related errors" },
  ALGORAND: { min: 410, max: 429, title: "Algorand node related errors" },
  KMD: { min: 440, max: 449, title: "KMD node related errors" },
  PyTEAL: { min: 450, max: 460, title: "Python (PyTeal) related errors" },

  BUILTIN_TASKS: { min: 600, max: 699, title: "Built-in tasks errors" },
  PLUGINS: { min: 800, max: 899, title: "Plugin system errors" },

  SCRIPT: { min: 900, max: 999, title: "Script related errors" }
};

const generalErrors = {
  NOT_INSIDE_PROJECT: {
    number: 1,
    message: "You are not inside an algob project.",
    title: "You are not inside an algob project",
    description: `You are trying to run algob outside of an algob project.

You can learn how to use algob by reading the [Getting Started guide](./README.md).`
  },
  INVALID_NODE_VERSION: {
    number: 2,
    message:
        "algob doesn't support your Node.js version. It should be %requirement%.",
    title: "Unsupported Node.js",
    description: `algob doesn't support your Node.js version.

Please upgrade your version of Node.js and try again.`
  },
  UNSUPPORTED_OPERATION: {
    number: 3,
    message: "%operation% is not supported in algob.",
    title: "Unsupported operation",
    description: `You are tying to perform an unsupported operation.

Unless you are creating a task or plugin, this is probably a bug.

Please [report it](https://github.com/scale-it/algorand-builder/issues/new) to help us improve algob.`
  },
  CONTEXT_ALREADY_CREATED: {
    number: 4,
    message: "algobContext is already created.",
    title: "algob was already initialized",
    description: `algob initialization was executed twice. This is a bug.

Please [report it](https://github.com/scale-it/algorand-builder/issues/new) to help us improve algob.`
  },
  CONTEXT_NOT_CREATED: {
    number: 5,
    message: "algobContext is not created.",
    title: "algob wasn't initialized",
    description: `algob initialization failed. This is a bug.

Please [report it](https://github.com/scale-it/algorand-builder/issues/new) to help us improve algob.`
  },
  CONTEXT_BRE_NOT_DEFINED: {
    number: 6,
    message:
        "algob Runtime Environment is not defined in the algobContext.",
    title: "algob Runtime Environment not created",
    description: `algob initialization failed. This is a bug.

Please [report it](https://github.com/scale-it/algorand-builder/issues/new) to help us improve algob.`
  },
  CONTEXT_BRE_ALREADY_DEFINED: {
    number: 7,
    message:
        "algob Runtime Environment is already defined in the algobContext",
    title: "Tried to create the algob Runtime Environment twice",
    description: `The algob initialization process was executed twice. This is a bug.

Please [report it](https://github.com/scale-it/algorand-builder/issues/new) to help us improve algob.`
  },
  INVALID_CONFIG: {
    number: 8,
    message: `There's one or more errors in your config file:

%errors%

To learn more about algob's configuration, please go to https://github.com/scale-it/algorand-builder`,
    title: "Invalid algob config",
    description: `You have one or more errors in your config file.

Check the error message for details, or go to [documentation](https://github.com/scale-it/algorand-builder) to learn more.`
  },
  LIB_IMPORTED_FROM_THE_CONFIG: {
    number: 9,
    message: `Error while loading algob's configuration.
You probably imported @scale-it/algorand-builder instead of @scale-it/algorand-builder/config`,
    title: "Failed to load config file",
    description: `There was an error while loading your config file.

The most common source of errors is trying to import \`@scale-it/algorand-builder\` instead of \`@scale-it/algorand-builder/config\`.

Please make sure your config file is correct.`
  },
  USER_CONFIG_MODIFIED: {
    number: 10,
    message: `Error while loading algob's configuration.
You or one of your plugins is trying to modify the userConfig.%path% value from a config extender`,
    title: "Attempted to modify the user's config",
    description: `An attempt to modify the user's config was made.

This is probably a bug in one of your plugins.

Please [report it](https://github.com/scale-it/algorand-builder/issues/new) to help us improve algob.`
  },
  INIT_INSIDE_PROJECT: {
    number: 11,
    message: "Algob project file was detected: '%clashingFile%'. Move the file or use an empty directory.",
    title: "Directory contains a algob file",
    description: `You are trying to run Algob in a directory that contains algob project file.`
  },
  NO_DEFAULT_EXPORT_IN_SCRIPT: {
    number: 12,
    message: "Error. '%script%' doesn't have an exported default function.",
    title: "No exported default function",
    description: `Script doesn't export a default function.

Please check algob output for more details.`
  },
  SCRIPT_LOAD_ERROR: {
    number: 13,
    message: "Error. Script '%script%' failed during load: %error%",
    title: "Script can't load",
    description: `Script failed during load.
Please check algob output for more details.`
  }
};

const networkErrors = {
  CONFIG_NOT_FOUND: {
    number: 100,
    message: "Network %network% doesn't exist",
    title: "Selected network doesn't exist",
    description: `You are trying to run algob with a non-existent network.

Verify you config and either change a network with '--network' parameter or a make sure the '%network%' exists.

Read the [documentation](https://github.com/scale-it/algorand-builder) to learn how to define custom networks.`
  },
  INVALID_GLOBAL_CHAIN_NAME: {
    number: 101,
    message:
        "algob was set to use chain_name %configChainName%, but connected to a chain with name %connectionChainName%.",
    title: "Connected to the wrong network",
    description: `Your config specifies a chain for the network you are trying to used, but algob detected anotherone.

Please make sure you are setting your config correctly.`
  },
  MISSING_TX_PARAM_TO_SIGN_LOCALLY: {
    number: 105,
    message: "Missing param %param% from a tx being signed locally.",
    title: "Missing transaction parameter",
    description: `You are trying to send a transaction with a locally managed
account, and some parameters are missing.

Please double check your transactions' parameters.`
  },
  NO_KMD_ACCOUNT_AVAILABLE: {
    number: 106,
    message:
        "No local account was set and there are accounts in the KMD.",
    title: "No KMD accounts available",
    description: `No local account was set and there are accounts in the KMD.

Please make sure that your KMD has unlocked accounts.`
  },
  INVALID_HD_PATH: {
    number: 107,
    message:
        "HD path %path% is invalid. Read about BIP32 to know about the valid forms.",
    title: "Invalid HD path",
    description: `An invalid HD/BIP32 derivation path was provided in your config.

Read the [documentation](https://github.com/scale-it/algorand-builder) to learn how to define HD accounts correctly.`
  },
  INVALID_RPC_QUANTITY_VALUE: {
    number: 108,
    message:
        "Received invalid value `%value%` from/to the node's JSON-RPC, but a Quantity was expected.",
    title: "Invalid JSON-RPC value",
    description: `One of your transactions sent or received an invalid JSON-RPC QUANTITY value.

Please double check your calls' parameters and keep your Ethereum node up to date.`
  },
  NODE_IS_NOT_RUNNING: {
    number: 109,
    message: `Cannot connect to the network %network%.
Please make sure your node is running, and check your internet connection and networks config`,
    title: "Cannot connect to the network",
    description: `Cannot connect to the network.

Please make sure your node is running, and check your internet connection and networks config.`
  },
  NETWORK_TIMEOUT: {
    number: 110,
    message: `Network connection timed-out.
Please check your internet connection and networks config`,
    title: "Network timeout",
    description: `One of your JSON-RPC requests timed-out.

Please make sure your node is running, and check your internet connection and networks config.`
  },
  INVALID_JSON_RESPONSE: {
    number: 111,
    message: "Invalid JSON-RPC response received: %response%",
    title: "Invalid JSON-RPC response",
    description: `One of your JSON-RPC requests received an invalid response.

Please make sure your node is running, and check your internet connection and networks config.`
  },
  CANT_DERIVE_KEY: {
    number: 112,
    message:
        "Cannot derive key %path% from mnemonic '%mnemonic%.\nTry using another mnemonic or deriving less keys.",
    title: "Could not derive an HD key",
    description: `One of your HD keys could not be derived.

Try using another mnemonic or deriving less keys.`
  }
};

const taskDefErrors = {
  PARAM_AFTER_VARIADIC: {
    number: 200,
    message:
        "Could not set positional param %paramName% for task %taskName% because there is already a variadic positional param and it has to be the last positional one.",
    title: "Could not add positional parameter",
    description: `Could add a positional param to your task because
there is already a variadic positional param and it has to be the last
positional one.

Please double check your task definitions.`
  },
  PARAM_ALREADY_DEFINED: {
    number: 201,
    message:
        "Could not set param %paramName% for task %taskName% because its name is already used.",
    title: "Repeated param name",
    description: `Could not add a param to your task because its name is already used.

Please double check your task definitions.`
  },
  PARAM_CLASHES_WITH_ALGOB_PARAM: {
    number: 202,
    message:
        "Could not set param %paramName% for task %taskName% because its name is used as a param for algob.",
    title: "algob and task param names clash",
    description: `Could not add a param to your task because its name is used as a param for algob.

Please double check your task definitions.`
  },
  MANDATORY_PARAM_AFTER_OPTIONAL: {
    number: 203,
    message:
        "Could not set param %paramName% for task %taskName% because it is mandatory and it was added after an optional positional param.",
    title: "Optional param followed by a required one",
    description: `Could not add param to your task because it is required and it was added after an optional positional param.

Please double check your task definitions.`
  },
  OVERRIDE_NO_PARAMS: {
    number: 204,
    message:
        "Redefinition of task %taskName% failed. You can't change param definitions in an overridden task.",
    title: "Attempted to add params to an overridden task",
    description: `You can't change param definitions in an overridden task.

Please, double check your task definitions.`
  },
  OVERRIDE_NO_MANDATORY_PARAMS: {
    number: 210,
    message:
        "Redefinition of task %taskName% failed. Unsupported operation adding mandatory (non optional) param definitions in an overridden task.",
    title: "Attempted to add mandatory params to an overridden task",
    description: `You can't add mandatory (non optional) param definitions in an overridden task.
The only supported param additions for overridden tasks are flags,
and optional params.

Please, double check your task definitions.`
  },
  OVERRIDE_NO_POSITIONAL_PARAMS: {
    number: 211,
    message:
        "Redefinition of task %taskName% failed. Unsupported operation adding positional param definitions in an overridden task.",
    title: "Attempted to add positional params to an overridden task",
    description: `You can't add positional param definitions in an overridden task.
The only supported param additions for overridden tasks are flags,
and optional params.

Please, double check your task definitions.`
  },
  OVERRIDE_NO_VARIADIC_PARAMS: {
    number: 212,
    message:
        "Redefinition of task %taskName% failed. Unsupported operation adding variadic param definitions in an overridden task.",
    title: "Attempted to add variadic params to an overridden task",
    description: `You can't add variadic param definitions in an overridden task.
The only supported param additions for overridden tasks are flags,
and optional params.

Please, double check your task definitions.`
  },

  ACTION_NOT_SET: {
    number: 205,
    message: "No action set for task %taskName%.",
    title: "Tried to run task without an action",
    description: `A task was run, but it has no action set.

Please double check your task definitions.`
  },
  RUNSUPER_NOT_AVAILABLE: {
    number: 206,
    message:
        "Tried to call runSuper from a non-overridden definition of task %taskName%",
    title: "`runSuper` not available",
    description: `You tried to call \`runSuper\` from a non-overridden task.

Please use \`runSuper.isDefined\` to make sure that you can call it.`
  },
  DEFAULT_VALUE_WRONG_TYPE: {
    number: 207,
    message:
        "Default value for param %paramName% of task %taskName% doesn't match the default one, try specifying it.",
    title: "Default value has incorrect type",
    description: `One of your tasks has a parameter whose default value doesn't match the expected type.

Please double check your task definitions.`
  },
  DEFAULT_IN_MANDATORY_PARAM: {
    number: 208,
    message:
        "Default value for param %paramName% of task %taskName% shouldn't be set.",
    title: "Required parameter has a default value",
    description: `One of your tasks has a required parameter with a default value.

Please double check your task definitions.`
  },
  INVALID_PARAM_NAME_CASING: {
    number: 209,
    message:
        "Invalid param name %paramName% in task %taskName%. Param names must be camelCase.",
    title: "Invalid casing in parameter name",
    description: `Your parameter names must use camelCase.

Please double check your task definitions.`
  }
};

const argumentErrors = {
  INVALID_ENV_VAR_VALUE: {
    number: 300,
    message: "Invalid environment variable %varName%'s value: %value%",
    title: "Invalid environment variable value",
    description: `You are setting one of algob arguments using an environment variable, but it has an incorrect value.
Please double check your environment variables.`
  },
  INVALID_VALUE_FOR_TYPE: {
    number: 320,
    message: "Invalid value %value% for argument %name% of type positive_integer",
    title: "Invalid argument value",
    description: `One of your algob or task's arguments has an invalid value.
Please double check your arguments.`
  },
  INVALID_POSITIVE_INT: {
    number: 301,
    message: "Invalid value %value% for argument %name% of type %type%",
    title: "Invalid argument type",
    description: `One of your algob or task's arguments has an invalid type.
Please double check your arguments.`
  },
  INVALID_INPUT_FILE: {
    number: 302,
    message:
        "Invalid argument %name%: File %value% doesn't exist or is not a readable file.",
    title: "Invalid file argument",
    description: `One of your tasks expected a file as an argument, but you provided a
non-existent or non-readable file.
Please double check your arguments.`
  },
  UNRECOGNIZED_TASK: {
    number: 303,
    message: "Unrecognized task %task%. Try running help task to get a list of possible tasks.",
    title: "Unrecognized task",
    description: `Tried to run a non-existent task.
Please double check the name of the task you are trying to run.`
  },
  UNRECOGNIZED_COMMAND_LINE_ARG: {
    number: 304,
    message:
        "Unrecognized command line argument %argument%.\nNote that task arguments must come after the task name.",
    title: "Unrecognized command line argument",
    description: `algob couldn't recognize one of your command line arguments.

This may be because you are writing it before the task name. It should come after it.
Please double check how you invoked algob.`
  },
  UNRECOGNIZED_PARAM_NAME: {
    number: 305,
    message: "Unrecognized param %param%",
    title: "Unrecognized param",
    description: `algob couldn't recognize one of your tasks' parameters.

Please double check how you invoked algob or run your task.`
  },
  MISSING_TASK_ARGUMENT: {
    number: 306,
    message: "Missing task argument %param%",
    title: "Missing task argument",
    description: `You tried to run a task, but one of its required arguments was missing.
Please double check how you invoked algob or run your task.`
  },
  MISSING_POSITIONAL_ARG: {
    number: 307,
    message: "Missing positional argument %param%",
    title: "Missing task positional argument",
    description: `You tried to run a task, but one of its required arguments was missing.
Please double check how you invoked algob or run your task.`
  },
  UNRECOGNIZED_POSITIONAL_ARG: {
    number: 308,
    message: "Unrecognized positional argument %argument%",
    title: "Unrecognized task positional argument",
    description: `You tried to run a task with more positional arguments than needed.
Please double check how you invoked algob or run your task.`
  },
  REPEATED_PARAM: {
    number: 309,
    message: "Repeated parameter %param%",
    title: "Repeated task parameter",
    description: `You tried to run a task with a repeated parameter.
Please double check how you invoked algob or run your task.`
  },
  PARAM_NAME_INVALID_CASING: {
    number: 310,
    message: "Invalid param %param%. Command line params must be lowercase.",
    title: "Invalid casing in command line parameter",
    description: `You tried to run algob with a parameter with invalid casing. They must be lowercase.
Please double check how you invoked algob.`
  },
  INVALID_JSON_ARGUMENT: {
    number: 311,
    message: "Error parsing JSON value for argument %param%: %error%",
    title: "Invalid JSON parameter",
    description: `You tried to run a task with an invalid JSON parameter.
Please double check how you invoked algob or run your task.`
  }
};

const taskErrors = {
  RUN_FILES_NOT_FOUND: {
    number: 601,
    message: "Scripts don't exist: %scripts%.",
    title: "Scripts don't exist.",
    description: `Tried to use \`algob run\` to execute a non-existing script(s).

Please double check your script's path`
  },
  SCRIPT_EXECUTION_ERROR: {
    number: 602,
    message: "Error while executing script '%script%': %message%",
    title: "Error executing a script",
    description: `Script execution resulted in an error.

Please check algob output for more details.`
  },
  SCRIPTS_DIRECTORY_NOT_FOUND: {
    number: 603,
    message: "Script directory %directory% doesn't exist.",
    title: "Scripts directory doesn't exist",
    description: `Tried to use \`algob migrate\` with nonexistent scripts directory: %directory%.

Please check your directory`
  },
  SCRIPTS_NO_FILES_FOUND: {
    number: 604,
    message: "Script directory %directory% doesn't have any script files.",
    title: "Scripts don't exist",
    description: `Tried to use \`algob migrate\` with no scripts in directory %directory%.

Please double check your script's path`
  },
  SCRIPTS_OUTSIDE_SCRIPTS_DIRECTORY: {
    number: 605,
    message: "Attempted to execute a script outside scripts directory: %scripts%.",
    title: "Script is outside `scripts`",
    description: `Tried to run scripts that was outside scripts directory %scripts%.

Please double check your command parameters`
  },
  DEPLOYER_EDIT_OUTSIDE_DEPLOY: {
    number: 606,
    message: "Script tried to edit Deployer data using '%methodName%' outside 'deploy' action",
    title: "Deployer editing allowed only during 'deploy'.",
    description: `Script tried to edit Deployer data using '%methodName%' method.
Deployer data editing only allowed during 'deploy'.
Use 'deployer.isDeployMode' to check if editing is allowed.
`
  },
  CHECKPOINT_ERROR_DUPLICATE_ASSET_DEFINITION: {
    number: 607,
    message: "Encountered a duplicate asset definition: %assetName%",
    title: "Encountered a duplicate asset definition",
    description: `Encountered a duplicate asset definition: %assetName%.

Checkpoint files were edited by hand or an internal error occurred.
`
  },
  DEPLOYER_METADATA_ALREADY_PRESENT: {
    number: 608,
    message: "Metadata key is already set: %metadataKey%",
    title: "Metadata already present",
    description: `Metadata already present: %metadataKey%. Resetting is not allowed.

Use 'deployer.getCheckpointKV(key)' to check the current value.
`
  },
  DEPLOYER_ASSET_ALREADY_PRESENT: {
    number: 609,
    message: "Asset name is already used: %assetName%",
    title: "Asset name is already used",
    description: `Asset name is already used: %metadataKey%. Resetting is not allowed.

Use 'deployer.isDefined(name)' to check if the name is already used.
`
  },
  DEPLOY_SCRIPT_NON_DIRECT_CHILD: {
    number: 610,
    message: "Non-direct child scripts are not allowed in deploy: %scripts%.",
    title: "Non-direct child scripts are not allowed in deploy",
    description: `Non-direct child scripts are not allowed in deploy: %scripts%.

Please double check your command parameters`
  },
  DEPLOYER_ASA_DEF_NOT_FOUND: {
    number: 611,
    message: "ASA definition not found: %asaName%",
    title: "Asset definition not found",
    description: `ASA definition not found: %asaName%.

Make sure your 'asa.yaml' file contains this entry.
`
  },
  DEPLOYER_ASA_NOT_DEFINED: {
    number: 612,
    message: "ASA is not defined: %assetName%",
    title: "ASA is not defined",
    description: `ASA is not defined: %assetName%.

If you defined this ASA make sure that current script name is ascii-larger than the one that defined the ASA.
Assets are not visible by previous scripts.

Use 'deployer.isDefined(name)' to check if the name is already used in any checkpoint.
`
  },
  ACCOUNT_NOT_FOUND: {
    number: 613,
    message: "Account with given name is not found: %assetName%",
    title: "Account with given name is not found",
    description: `Account with given name is not found.

Please check your config file.
`
  },
  TESTS_DIRECTORY_NOT_FOUND: {
    number: 614,
    message: "Tests directory %directory% doesn't exist.",
    title: "Tests directory doesn't exist",
    description: `Tried to use \`algob test\` with nonexistent tests directory: %directory%.

Please check your directory`
  }
};

const pluginErrors = {
  NOT_INSTALLED: {
    number: 800,
    message: `Plugin %plugin% is not installed.
%extraMessage%Please run: npm install --save-dev%extraFlags% %plugin%`,
    title: "Plugin not installed",
    description: `You are trying to use a plugin that hasn't been installed.

Please follow algob's instructions to resolve this.`
  },
  MISSING_DEPENDENCY: {
    number: 801,
    message: `Plugin %plugin% requires %dependency% to be installed.
%extraMessage%Please run: npm install --save-dev%extraFlags% "%dependency%@%versionSpec%"`,
    title: "Plugin dependencies not installed",
    description: `You are trying to use a plugin with unmet dependencies.

Please follow algob's instructions to resolve this.`
  },
  DEPENDENCY_VERSION_MISMATCH: {
    number: 802,
    message: `Plugin %plugin% requires %dependency% version %versionSpec% but got %installedVersion%.
%extraMessage%If you haven't installed %dependency% manually, please run: npm install --save-dev%extraFlags% "%dependency%@%versionSpec%"
If you have installed %dependency% yourself, please reinstall it with a valid version.`,
    title: "Plugin dependencies's version mismatch",
    description: `You are trying to use a plugin that requires a different version of one of its dependencies.

Please follow algob's instructions to resolve this.`
  },
  OLD_STYLE_IMPORT_DETECTED: {
    number: 803,
    message: `You are trying to load %pluginNameText% with a require or import statement.
Please replace it with a call to usePlugin("%pluginNameCode%").`,
    title: "Importing a plugin with `require`",
    description: `You are trying to load a plugin with a call to \`require\`.

Please use \`usePlugin(npm-plugin-package)\` instead.`
  }
};

const accountErrors = {
  MNEMONIC_ADDR_MISSMATCH: {
    number: 400,
    message: `Please use same address as the one specified in the mnemonic account (name: "%name%", addr: "%addr%", mnemonic: "%mnemonic%").`,
    title: "Wrong address for specified mnemonic account",
    description: "Mnemonic account encodes secret key, public key and address. The address from mnemonic account must mach the address specified in the account definition"
  },
  WRONG_MNEMONIC: {
    number: 401,
    message: `%errmsg%`,
    title: "Malformed mnemonic string",
    description: ""
  },
  HD_ACCOUNT: {
    number: 402,
    message: `HD accounts is not yet supported. Account path: %path%`,
    title: "HD accounts is not yet supported",
    description: ""
  },
  MALFORMED: {
    number: 403,
    message: `%errors%`,
    title: "Some accounts are malformed or have missing fields",
    description: ""
  },
  FIELD_REQUIRED: {
    number: 404,
    message: `%errors%`,
    title: "Field %field% is must be defined and not empty",
    description: ""
  }

};

const algorandNode = {
  BAD_REQUEST: {
    number: 410,
    message: `status_code=%status%,
%message%
context=%ctx%`,
    title: `Bad Request sent to an algorand node`,
    description: ""
  },
  INTERNAL_ERROR: {
    number: 411,
    message: `status_code=%status%`,
    title: `Internal Algorand node error`,
    description: "The algorand node is not stable and encountered internal error"
  }
};

const kmdNode = {
  CONNECTION: {
    number: 440,
    message: `Cannot connect to the KMD, context: %ctx%.
Please make sure a KMD is running, and check your internet connection and networks config`,
    title: "Cannot connect to the KMD",
    description: `Cannot connect to the KMD.

Please make sure a KMD is running, and check your internet connection and networks config.`
  },
  ERROR: {
    number: 448,
    message: `KMD error.
Context: %ctx%`,
    title: `KMD error`,
    description: "Can't make API call to KMD"
  }
};

const scriptErrors = {
  ASA_OPT_IN_ACCOUNT_INSUFFICIENT_BALANCE: {
    number: 900,
    message: `Account '%accountName%' has insufficient usable balance (%balance% out of %requiredBalance%) to opt-in to ASA '%asaName%'.`,
    title: "Account has insufficient usable balance to opt-in to ASA.",
    description: `Account '%accountName%' has insufficient usable balance (%balance% out of %requiredBalance%) to opt-in to ASA '%asaName%'.

Please transfer more funds`
  },
  ASA_OPT_IN_ACCOUNT_NOT_FOUND: {
    number: 901,
    message: `Account with name '%accountName%' was not found.`,
    title: "Account not found",
    description: `Account with name '%accountName%' was not found.`
  },
  ASA_TRIED_TO_OPT_IN_CREATOR: {
    number: 902,
    message: `Account with name '%accountName%' is the creator of ASA. It's automatically opt-in.`,
    title: "Account opt-in is not possible",
    description: `Account with name '%accountName%' is the creator of ASA. It's automatically opt-in.
Remove the account from the optInAccNames in asa.yaml`
  }
};

const pyTealErrors = {
  PYTEAL_FILE_ERROR: {
    number: 450,
    message: `PYTEAL PARSE ERROR: '%filename%'.
    Reason: %reason%`,
    title: "PYTEAL ERROR",
    description: `Reason: %reason%`
  }
};

export const ERRORS: {
  [category in keyof typeof ERROR_RANGES]: {
    [errorName: string]: ErrorDescriptor
  };
} = {
  GENERAL: generalErrors,
  NETWORK: networkErrors,
  TASK_DEFINITIONS: taskDefErrors,
  ARGUMENTS: argumentErrors,
  ACCOUNT: accountErrors,
  ALGORAND: algorandNode,
  KMD: kmdNode,
  BUILTIN_TASKS: taskErrors,
  PLUGINS: pluginErrors,
  SCRIPT: scriptErrors,
  PyTEAL: pyTealErrors
};
