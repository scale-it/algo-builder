import * as fs from "fs";

import { BuilderError } from "../../../errors/errors";
import { ERRORS } from "../../../errors/errors-list";

/**
 * Provides an interface for every valid task argument type.
 */
export interface ArgumentType<T> {
  /**
   * Type's name.
   */
  name: string

  /**
   * Parses strValue. This function MUST throw ALGORAND_BUILDER301 if it
   * can parse the given value.
   *
   * @param argName argument's name - used for context in case of error.
   * @param strValue argument's string value to be parsed.
   *
   * @throws ALGORAND_BUILDER301 if an invalid value is given.
   * @returns the parsed value.
   */
  parse: (argName: string, strValue: string) => T

  /**
   * Check if argument value is of type <T>. Optional method.
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param argumentValue - value to be validated
   *
   * @throws ALGORAND_BUILDER301 if value is not of type <t>
   */
  validate?(argName: string, argumentValue: any): void;  // eslint-disable-line
}

/**
 * String type.
 *
 * Accepts any kind of string.
 */
export const string: ArgumentType<string> = {
  name: "string",
  parse: (argName, strValue) => strValue,
  /**
   * Check if argument value is of type "string"
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   *
   * @throws ALGORAND_BUILDER301 if value is not of type "string"
   */
  validate: (argName: string, value: any): void => {  // eslint-disable-line
    const isString = typeof value === "string";

    if (!isString) {
      throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: string.name
      });
    }
  }
};

/**
 * Boolean type.
 *
 * Accepts only 'true' or 'false' (case-insensitive).
 * @throws ALGORAND_BUILDER301
 */
export const boolean: ArgumentType<boolean> = {
  name: "boolean",
  parse: (argName, strValue) => {
    if (strValue.toLowerCase() === "true") {
      return true;
    }
    if (strValue.toLowerCase() === "false") {
      return false;
    }

    throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
      value: strValue,
      name: argName,
      type: "boolean"
    });
  },
  /**
   * Check if argument value is of type "boolean"
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   *
   * @throws ALGORAND_BUILDER301 if value is not of type "boolean"
   */
  validate: (argName: string, value: any): void => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const isBoolean = typeof value === "boolean";

    if (!isBoolean) {
      throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: boolean.name
      });
    }
  }
};

/**
 * Int type.
 * Accepts either a decimal string integer or hexadecimal string integer.
 * @throws ALGORAND_BUILDER301
 */
export const int: ArgumentType<number> = {
  name: "int",
  parse: (argName, strValue) => {
    const decimalPattern = /^\d+(?:[eE]\d+)?$/;
    const hexPattern = /^0[xX][\dABCDEabcde]+$/;

    if (
      strValue.match(decimalPattern) === null &&
      strValue.match(hexPattern) === null
    ) {
      throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value: strValue,
        name: argName,
        type: int.name
      });
    }

    return Number(strValue);
  },
  /**
   * Check if argument value is of type "int"
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   *
   * @throws ALGORAND_BUILDER301 if value is not of type "int"
   */
  validate: (argName: string, value: any): void => {  // eslint-disable-line
    const isInt = Number.isInteger(value);
    if (!isInt) {
      throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: int.name
      });
    }
  }
};

/**
 * Float type.
 * Accepts either a decimal string number or hexadecimal string number.
 * @throws ALGORAND_BUILDER301
 */
export const float: ArgumentType<number> = {
  name: "float",
  parse: (argName, strValue) => {
    const decimalPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE]\d+)?$/;
    const hexPattern = /^0[xX][\dABCDEabcde]+$/;

    if (
      strValue.match(decimalPattern) === null &&
      strValue.match(hexPattern) === null
    ) {
      throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value: strValue,
        name: argName,
        type: float.name
      });
    }

    return Number(strValue);
  },
  /**
   * Check if argument value is of type "float".
   * Both decimal and integer number values are valid.
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   *
   * @throws ALGORAND_BUILDER301 if value is not of type "number"
   */
  validate: (argName: string, value: any): void => {  // eslint-disable-line
    const isFloatOrInteger = typeof value === "number" && !isNaN(value);

    if (!isFloatOrInteger) {
      throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: float.name
      });
    }
  }
};

/**
 * Input file type.
 * Accepts a path to a readable file..
 * @throws ALGORAND_BUILDER302
 */
export const inputFile: ArgumentType<string> = {
  name: "inputFile",
  parse (argName: string, strValue: string): string {
    try {
      fs.accessSync(strValue, fs.constants.R_OK);
      const stats = fs.lstatSync(strValue);

      if (stats.isDirectory()) {
        // This is caught and encapsulated in a algob error.
        // tslint:disable-next-line only-algob-error
        throw new Error(`${strValue} is a directory, not a file`);
      }
    } catch (error) {
      throw new BuilderError(
        ERRORS.ARGUMENTS.INVALID_INPUT_FILE,
        {
          name: argName,
          value: strValue
        },
        error
      );
    }

    return strValue;
  },
  /**
   * Check if argument value is of type "inputFile"
   * File string validation succeeds if it can be parsed, ie. is a valid accessible file dir
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   *
   * @throws ALGORAND_BUILDER301 if value is not of type "inputFile"
   */
  validate: (argName: string, value: any): void => {  // eslint-disable-line
    try {
      inputFile.parse(argName, value);
    } catch (error) {
      // the input value is considered invalid, throw error.
      throw new BuilderError(
        ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE,
        {
          value,
          name: argName,
          type: inputFile.name
        },
        error
      );
    }
  }
};

export const json: ArgumentType<any> = {  // eslint-disable-line
  name: "json",
  parse (argName: string, strValue: string): void {
    try {
      return JSON.parse(strValue);
    } catch (error) {
      throw new BuilderError(
        ERRORS.ARGUMENTS.INVALID_JSON_ARGUMENT,
        {
          param: argName,
          error: error.message
        },
        error
      );
    }
  },
  /**
   * Check if argument value is of type "json". We consider everything except
   * undefined to be json.
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   *
   * @throws ALGORAND_BUILDER301 if value is not of type "json"
   */
  validate: (argName: string, value: any): void => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (value === undefined) {
      throw new BuilderError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: json.name
      });
    }
  }
};
