import {
  AlgobParamDefinitions,
  ParamDefinition,
  ParamDefinitionsMap,
  RuntimeArgs,
  TaskArguments,
  TaskDefinition,
} from "../../types";
import { BuilderError } from "../core/errors";
import { ERRORS } from "../core/errors-list";

export class ArgumentsParser {
  public static readonly PARAM_PREFIX = "--";

  public static paramNameToCLA(paramName: string): string {
    return (
      ArgumentsParser.PARAM_PREFIX +
      paramName
        .split(/(?=[A-Z])/g)
        .map((s) => s.toLowerCase())
        .join("-")
    );
  }

  public static cLAToParamName(cLA: string): string {
    if (cLA.toLowerCase() !== cLA) {
      throw new BuilderError(ERRORS.ARGUMENTS.PARAM_NAME_INVALID_CASING, {
        param: cLA,
      });
    }

    const parts = cLA.slice(ArgumentsParser.PARAM_PREFIX.length).split("-");

    return (
      parts[0] +
      parts
        .slice(1)
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join("")
    );
  }

  public parseRuntimeArgs(
    algobParamDefs: AlgobParamDefinitions,
    envVariableArguments: RuntimeArgs,
    rawCLAs: string[]
  ): {
    runtimeArgs: RuntimeArgs;
    taskName?: string;
    unparsedCLAs: string[];
  } {
    const runtimeArgs: Partial<RuntimeArgs> = {};
    let taskName: string | undefined;
    const unparsedCLAs: string[] = [];

    for (let i = 0; i < rawCLAs.length; i++) {
      const arg = rawCLAs[i];

      if (taskName === undefined) {
        if (!this._hasCLAParamNameFormat(arg)) {
          taskName = arg;
          continue;
        }

        if (!this._isCLAParamName(arg, algobParamDefs)) {
          throw new BuilderError(
            ERRORS.ARGUMENTS.UNRECOGNIZED_COMMAND_LINE_ARG,
            { argument: arg }
          );
        }

        i = this._parseArgumentAt(
          rawCLAs,
          i,
          algobParamDefs,
          runtimeArgs
        );
      } else {
        if (!this._isCLAParamName(arg, algobParamDefs)) {
          unparsedCLAs.push(arg);
          continue;
        }

        i = this._parseArgumentAt(
          rawCLAs,
          i,
          algobParamDefs,
          runtimeArgs
        );
      }
    }

    return {
      runtimeArgs: this._addBuilderDefaultArguments(
        algobParamDefs,
        envVariableArguments,
        runtimeArgs
      ),
      taskName,
      unparsedCLAs,
    };
  }

  public parseTaskArguments(
    taskDefinition: TaskDefinition,
    rawCLAs: string[]
  ): TaskArguments {
    const {
      paramArguments,
      rawPositionalArguments,
    } = this._parseTaskParamArguments(taskDefinition, rawCLAs);

    const positionalArguments = this._parsePositionalParamArgs(
      rawPositionalArguments,
      taskDefinition.positionalParamDefinitions
    );

    return { ...paramArguments, ...positionalArguments };
  }

  private _parseTaskParamArguments(
    taskDefinition: TaskDefinition,
    rawCLAs: string[]
  ) {
    const paramArguments = {};
    const rawPositionalArguments: string[] = [];

    for (let i = 0; i < rawCLAs.length; i++) {
      const arg = rawCLAs[i];

      if (!this._hasCLAParamNameFormat(arg)) {
        rawPositionalArguments.push(arg);
        continue;
      }

      if (!this._isCLAParamName(arg, taskDefinition.paramDefinitions)) {
        throw new BuilderError(ERRORS.ARGUMENTS.UNRECOGNIZED_PARAM_NAME, {
          param: arg,
        });
      }

      i = this._parseArgumentAt(
        rawCLAs,
        i,
        taskDefinition.paramDefinitions,
        paramArguments
      );
    }

    this._addTaskDefaultArguments(taskDefinition, paramArguments);

    return { paramArguments, rawPositionalArguments };
  }

  private _addBuilderDefaultArguments(
    algobParamDefs: AlgobParamDefinitions,
    envVariableArguments: RuntimeArgs,
    runtimeArgs: Partial<RuntimeArgs>
  ): RuntimeArgs {
    return {
      ...envVariableArguments,
      ...runtimeArgs,
    };
  }

  private _addTaskDefaultArguments(
    taskDefinition: TaskDefinition,
    taskArguments: TaskArguments
  ) {
    for (const paramName of Object.keys(taskDefinition.paramDefinitions)) {
      const definition = taskDefinition.paramDefinitions[paramName];

      if (taskArguments[paramName] !== undefined) {
        continue;
      }
      if (!definition.isOptional) {
        throw new BuilderError(ERRORS.ARGUMENTS.MISSING_TASK_ARGUMENT, {
          param: ArgumentsParser.paramNameToCLA(paramName),
        });
      }

      taskArguments[paramName] = definition.defaultValue;
    }
  }

  private _isCLAParamName(str: string, paramDefinitions: ParamDefinitionsMap) {
    if (!this._hasCLAParamNameFormat(str)) {
      return false;
    }

    const name = ArgumentsParser.cLAToParamName(str);
    return paramDefinitions[name] !== undefined;
  }

  private _hasCLAParamNameFormat(str: string) {
    return str.startsWith(ArgumentsParser.PARAM_PREFIX);
  }

  private _parseArgumentAt(
    rawCLAs: string[],
    index: number,
    paramDefinitions: ParamDefinitionsMap,
    parsedArguments: TaskArguments
  ) {
    const claArg = rawCLAs[index];
    const paramName = ArgumentsParser.cLAToParamName(claArg);
    const definition = paramDefinitions[paramName];

    if (parsedArguments[paramName] !== undefined) {
      throw new BuilderError(ERRORS.ARGUMENTS.REPEATED_PARAM, {
        param: claArg,
      });
    }

    if (definition.isFlag) {
      parsedArguments[paramName] = true;
    } else {
      index++;
      const value = rawCLAs[index];

      if (value === undefined) {
        throw new BuilderError(ERRORS.ARGUMENTS.MISSING_TASK_ARGUMENT, {
          param: ArgumentsParser.paramNameToCLA(paramName),
        });
      }

      parsedArguments[paramName] = definition.type.parse(paramName, value);
    }

    return index;
  }

  private _parsePositionalParamArgs(
    rawPositionalParamArgs: string[],
    positionalParamDefinitions: Array<ParamDefinition<any>> // eslint-disable-line @typescript-eslint/no-explicit-any
  ): TaskArguments {
    const args: TaskArguments = {};

    for (let i = 0; i < positionalParamDefinitions.length; i++) {
      const definition = positionalParamDefinitions[i];

      const rawArg = rawPositionalParamArgs[i];

      if (rawArg === undefined) {
        if (!definition.isOptional) {
          throw new BuilderError(ERRORS.ARGUMENTS.MISSING_POSITIONAL_ARG, {
            param: definition.name,
          });
        }

        args[definition.name] = definition.defaultValue;
      } else if (!definition.isVariadic) {
        args[definition.name] = definition.type.parse(definition.name, rawArg);
      } else {
        args[definition.name] = rawPositionalParamArgs
          .slice(i)
          .map((raw) => definition.type.parse(definition.name, raw));
      }
    }

    const lastDefinition =
      positionalParamDefinitions[positionalParamDefinitions.length - 1];

    const hasVariadicParam =
      lastDefinition !== undefined && lastDefinition.isVariadic;

    if (
      !hasVariadicParam &&
      rawPositionalParamArgs.length > positionalParamDefinitions.length
    ) {
      throw new BuilderError(ERRORS.ARGUMENTS.UNRECOGNIZED_POSITIONAL_ARG, {
        argument: rawPositionalParamArgs[positionalParamDefinitions.length],
      });
    }

    return args;
  }
}
